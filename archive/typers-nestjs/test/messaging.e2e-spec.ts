import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { firstValueFrom, from, lastValueFrom, timeout, toArray } from 'rxjs';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { MessageLogService } from '../src/messaging/message-log.service.js';
import {
  CREATED_PATTERN,
  SUM_PATTERN,
} from '../src/messaging/messaging.controller.js';
import {
  startCustomTransportDemo,
  startGrpcDemo,
  startHybridDemo,
  startSocketDemo,
  startTcpDemo,
} from '../src/messaging/messaging.harness.js';
import { GatewayLifecycle } from '../src/messaging/socket-support.js';

interface SumResult {
  result: number;
  correlationId: string;
  stages: string[];
}

for (const [name, start] of [
  ['TCP', startTcpDemo],
  ['custom HTTP/NDJSON', startCustomTransportDemo],
] as const) {
  describe(`Microservice ${name}`, () => {
    let demo: Awaited<ReturnType<typeof start>>;
    beforeAll(async () => {
      demo = await start();
    });
    afterAll(async () => {
      await demo?.close();
    });

    it('executes request-response through hooks, guard, interceptor, pipe and handler', async () => {
      const result = await firstValueFrom(
        demo.client
          .send<SumResult>(SUM_PATTERN, {
            values: [2, 3, 5],
            correlationId: 'trace-demo',
          })
          .pipe(timeout(3000)),
      );
      expect(result.result).toBe(10);
      expect(result.correlationId).toBe('trace-demo');
      expect(result.stages).toEqual(
        expect.arrayContaining([
          'hook:context',
          'hook:second',
          'guard',
          'interceptor:before',
          'pipe',
          'handler',
          'interceptor:after',
        ]),
      );
      expect(result.stages.indexOf('hook:second')).toBeLessThan(
        result.stages.indexOf('guard'),
      );
      expect(result.stages.indexOf('guard')).toBeLessThan(
        result.stages.indexOf('interceptor:before'),
      );
      expect(result.stages.indexOf('interceptor:before')).toBeLessThan(
        result.stages.indexOf('pipe'),
      );
      expect(result.stages.indexOf('pipe')).toBeLessThan(
        result.stages.indexOf('handler'),
      );
    });

    it('isolates AsyncLocalStorage correlations for concurrent messages', async () => {
      const results = await Promise.all(
        ['alpha', 'beta'].map((correlationId) =>
          firstValueFrom(
            demo.client
              .send<SumResult>(SUM_PATTERN, { values: [1], correlationId })
              .pipe(timeout(3000)),
          ),
        ),
      );
      expect(results.map((value) => value.correlationId)).toEqual([
        'alpha',
        'beta',
      ]);
    });

    it('delivers events to the actual controller', async () => {
      const id = randomUUID();
      await lastValueFrom(
        demo.client
          .emit(CREATED_PATTERN, { id, value: name })
          .pipe(timeout(3000)),
      );
      await expect
        .poll(() => demo.app.get(MessageLogService).get(id))
        .toMatchObject({ id, value: name });
    });

    it('returns filter errors for invalid DTOs and denied access', async () => {
      await expect(
        firstValueFrom(
          demo.client
            .send(SUM_PATTERN, { values: ['wrong'] })
            .pipe(timeout(3000)),
        ),
      ).rejects.toMatchObject({
        code: 'DEMO_RPC_ERROR',
        message: 'VALIDATION_FAILED',
      });
      await expect(
        firstValueFrom(
          demo.client
            .send(SUM_PATTERN, { values: [1], authorized: false })
            .pipe(timeout(3000)),
        ),
      ).rejects.toMatchObject({
        code: 'DEMO_RPC_ERROR',
        message: 'ACCESS_DENIED',
      });
    });

    it('streams multiple replies and bounds an unanswered request with timeout', async () => {
      const replies = await firstValueFrom(
        demo.client
          .send<SumResult>('demo.stream', { values: [2, 4, 6] })
          .pipe(timeout(3000), toArray()),
      );
      expect(replies.map(({ result }) => result)).toEqual([2, 4, 6]);
      await expect(
        firstValueFrom(demo.client.send('demo.never', {}).pipe(timeout(50))),
      ).rejects.toMatchObject({ name: 'TimeoutError' });
    });
  });
}

describe('Hybrid HTTP and TCP application', () => {
  it('shares the provider container across HTTP and microservice listeners', async () => {
    const demo = await startHybridDemo();
    try {
      const id = randomUUID();
      await lastValueFrom(
        demo.client
          .emit(CREATED_PATTERN, { id, value: 'hybrid' })
          .pipe(timeout(3000)),
      );
      await expect
        .poll(() => demo.app.get(MessageLogService).get(id))
        .toBeDefined();
      const response = await fetch(`${demo.url}/messaging/status`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        events: [{ id, value: 'hybrid', transport: 'tcp' }],
      });
    } finally {
      await demo.close();
    }
  });
});

describe('gRPC with a real protobuf service', () => {
  let demo: Awaited<ReturnType<typeof startGrpcDemo>>;
  beforeAll(async () => {
    demo = await startGrpcDemo();
  });
  afterAll(async () => {
    await demo?.close();
  });

  it('calls a unary method and consumes a server stream', async () => {
    expect(
      await firstValueFrom(
        demo.calculator.sum({ values: [2, 5] }).pipe(timeout(3000)),
      ),
    ).toEqual({ result: 7 });
    expect(
      await firstValueFrom(
        demo.calculator
          .numbers({ values: [2, 5] })
          .pipe(timeout(3000), toArray()),
      ),
    ).toEqual([{ result: 2 }, { result: 5 }]);
  });

  it('sends a client stream and exchanges a bidirectional stream', async () => {
    const values = [{ value: 2 }, { value: 5 }];
    expect(
      await firstValueFrom(
        demo.calculator.accumulate(from(values)).pipe(timeout(3000)),
      ),
    ).toEqual({ result: 7 });
    expect(
      await firstValueFrom(
        demo.calculator.double(from(values)).pipe(timeout(3000), toArray()),
      ),
    ).toEqual([{ result: 4 }, { result: 10 }]);
  });
});

function socketEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const onValue = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      socket.off(event, onValue);
      reject(new Error(`Missing Socket.IO event ${event}`));
    }, 3000);
    socket.once(event, onValue);
  });
}

async function openSocketIo(url: string): Promise<Socket> {
  const socket = io(url, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
  });
  const connected = socketEvent(socket, 'connect');
  socket.connect();
  await connected;
  return socket;
}

describe('Socket.IO gateway and adapter', () => {
  let demo: Awaited<ReturnType<typeof startSocketDemo>>;
  let first: Socket;
  let second: Socket;
  beforeAll(async () => {
    demo = await startSocketDemo('socket.io');
    first = await openSocketIo(demo.url);
    second = await openSocketIo(demo.url);
  });
  afterAll(async () => {
    first?.close();
    second?.close();
    await demo?.close();
  });

  it('acknowledges implicitly and explicitly and runs gateway lifecycle', async () => {
    expect(
      await first.timeout(3000).emitWithAck('echo', { text: 'hello' }),
    ).toEqual({ text: 'hello', intercepted: true });
    expect(
      await first.timeout(3000).emitWithAck('explicit-ack', { text: 'manual' }),
    ).toEqual({ text: 'manual', explicit: true });
    expect(demo.app.get(GatewayLifecycle)).toMatchObject({
      initialized: true,
      connections: 2,
    });
  });

  it('broadcasts to another client and emits Observable responses', async () => {
    const broadcast = socketEvent(second, 'broadcast');
    await first.timeout(3000).emitWithAck('announce', { text: 'everyone' });
    expect(await broadcast).toEqual({ text: 'everyone' });
    const words: unknown[] = [];
    const listener = (word: unknown) => words.push(word);
    first.on('word', listener);
    first.emit('stream', { text: 'one two' });
    try {
      await expect
        .poll(() => words)
        .toEqual([
          { text: 'one', intercepted: true },
          { text: 'two', intercepted: true },
        ]);
    } finally {
      first.off('word', listener);
    }
  });

  it('reports DTO and guard failures through the WebSocket exception filter', async () => {
    const invalid = socketEvent(first, 'exception');
    first.emit('echo', { text: 42 });
    expect(await invalid).toEqual({
      code: 'DEMO_WS_ERROR',
      message: 'VALIDATION_FAILED',
    });
    const denied = socketEvent(first, 'exception');
    first.emit('echo', { text: 'denied', authorized: false });
    expect(await denied).toEqual({
      code: 'DEMO_WS_ERROR',
      message: 'ACCESS_DENIED',
    });
  });
});

function rawEvent<T>(socket: WebSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: RawData) => {
      const bytes = Array.isArray(raw)
        ? Buffer.concat(raw)
        : raw instanceof ArrayBuffer
          ? Buffer.from(raw)
          : raw;
      const packet = JSON.parse(bytes.toString('utf8')) as {
        event: string;
        data: T;
      };
      if (packet.event !== event) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(packet.data);
    };
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error(`Missing ws event ${event}`));
    }, 3000);
    socket.on('message', onMessage);
  });
}

describe('ws gateway and adapter', () => {
  let demo: Awaited<ReturnType<typeof startSocketDemo>>;
  let first: WebSocket;
  let second: WebSocket;
  beforeAll(async () => {
    demo = await startSocketDemo('ws');
    first = new WebSocket(`${demo.url.replace('http:', 'ws:')}/ws`);
    await once(first, 'open');
    second = new WebSocket(`${demo.url.replace('http:', 'ws:')}/ws`);
    await once(second, 'open');
  });
  afterAll(async () => {
    await Promise.all(
      [first, second].filter(Boolean).map(async (socket) => {
        const closed = once(socket, 'close');
        socket.close();
        await closed;
      }),
    );
    await demo?.close();
  });

  it('uses event/data packets, broadcasts and runs the interceptor', async () => {
    const reply = rawEvent(first, 'reply');
    first.send(JSON.stringify({ event: 'echo', data: { text: 'hello' } }));
    expect(await reply).toEqual({ text: 'hello', intercepted: true });
    const broadcast = rawEvent(second, 'broadcast');
    first.send(JSON.stringify({ event: 'announce', data: { text: 'all' } }));
    expect(await broadcast).toEqual({ text: 'all' });
    expect(demo.app.get(GatewayLifecycle)).toMatchObject({
      initialized: true,
      connections: 2,
    });
  });

  it('filters validation and guard exceptions over the raw WebSocket', async () => {
    const invalid = rawEvent(first, 'exception');
    first.send(JSON.stringify({ event: 'echo', data: { text: 7 } }));
    expect(await invalid).toEqual({
      code: 'DEMO_WS_ERROR',
      message: 'VALIDATION_FAILED',
    });
    const denied = rawEvent(first, 'exception');
    first.send(
      JSON.stringify({
        event: 'echo',
        data: { text: 'denied', authorized: false },
      }),
    );
    expect(await denied).toEqual({
      code: 'DEMO_WS_ERROR',
      message: 'ACCESS_DENIED',
    });
  });
});
