import { fork, type ChildProcess, execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface WireSpan {
  n?: string;
  c?: string;
  m?: string;
  t?: Record<string, unknown>;
  ch?: WireSpan[];
  e?: unknown;
}
interface WireSnapshot {
  ti: string;
  a?: { ou?: string; sc?: number };
  t?: WireSpan[];
  e?: unknown;
}
interface WireMetric {
  n: string;
  t: string;
  v?: Record<string, number>;
  ct?: Record<string, number>;
  sm?: Record<string, number>;
  q50?: Record<string, number>;
}
interface WireLog {
  text: string;
  traceId?: string;
  attributes?: Record<string, unknown>;
}
interface TelemetryBatch {
  serviceId: string;
  snapshots?: WireSnapshot[];
  custom?: WireMetric[];
  logs?: WireLog[];
  runtime?: Record<string, unknown>;
}
interface ReceivedBatch {
  headers: IncomingHttpHeaders;
  payload: TelemetryBatch;
}
interface ReadyMessage {
  type: 'ready';
  url: string;
  devtoolsUrl: string;
}
const execFileAsync = promisify(execFile);

function spans(nodes: WireSpan[] = []): WireSpan[] {
  return nodes.flatMap((node) => [node, ...spans(node.ch)]);
}

describe('Observe SDK and Devtools over real local HTTP', () => {
  let collector: Server;
  let child: ChildProcess;
  let appUrl: string;
  let devtoolsUrl: string;
  let childOutput = '';
  let childClosed = false;
  const batches: ReceivedBatch[] = [];
  const snapshots = () =>
    batches.flatMap((batch) => batch.payload.snapshots ?? []);
  const snapshot = (id: string) => snapshots().find((entry) => entry.ti === id);

  beforeAll(async () => {
    await execFileAsync(
      process.execPath,
      [
        'node_modules/typescript/bin/tsc',
        '-p',
        'src/observability/tsconfig.lab.json',
      ],
      { cwd: resolve('.'), timeout: 20000 },
    );
    collector = createServer((req, res) => {
      if (req.url === '/upstream') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            receivedTraceId: req.headers['x-request-id'] ?? null,
          }),
        );
        return;
      }
      if (req.method !== 'POST' || req.url !== '/applications/telemetry') {
        res.writeHead(404);
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const bytes = Buffer.concat(chunks);
          const body =
            req.headers['content-encoding'] === 'gzip'
              ? gunzipSync(bytes)
              : bytes;
          batches.push({
            headers: req.headers,
            payload: JSON.parse(body.toString('utf8')) as TelemetryBatch,
          });
          res.writeHead(201, { 'content-type': 'application/json' });
          res.end('{"accepted":true}');
        } catch {
          res.writeHead(400);
          res.end();
        }
      });
    });
    collector.listen(0, '127.0.0.1');
    await once(collector, 'listening');
    const address = collector.address();
    if (!address || typeof address === 'string')
      throw new Error('No collector port');
    child = fork(resolve('dist-observe/main.fixture.js'), [], {
      cwd: resolve('.'),
      silent: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        OBSERVE_TEST_ENDPOINT: `http://127.0.0.1:${address.port}`,
        OBSERVE_ENDPOINT: `http://127.0.0.1:${address.port}`,
        OBSERVE_APP_KEY: 'local-test-key',
        OBSERVE_APP_SECRET: 'local-test-secret',
      },
    });
    child.stdout?.on('data', (data: Buffer) => {
      childOutput += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      childOutput += data.toString();
    });
    child.on('message', (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'closed'
      )
        childClosed = true;
    });
    const ready = await new Promise<ReadyMessage>((resolveReady, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Observe child startup exceeded 10 seconds')),
        10000,
      );
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Observe child exited before startup (${code})`));
      });
      child.on('message', (message: unknown) => {
        if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'ready'
        ) {
          clearTimeout(timeout);
          resolveReady(message as ReadyMessage);
        }
      });
    });
    appUrl = ready.url;
    devtoolsUrl = ready.devtoolsUrl;
  }, 30000);

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await vi
        .waitFor(
          () =>
            expect(child.exitCode !== null || child.signalCode !== null).toBe(
              true,
            ),
          { timeout: 5000 },
        )
        .catch(() => {
          child.kill('SIGKILL');
        });
    }
    if (collector?.listening) {
      collector.closeAllConnections();
      await new Promise<void>((done, reject) =>
        collector.close((error) => (error ? reject(error) : done())),
      );
    }
  });

  it('exports nested spans, current trace context and custom metrics through the real SDK worker', async () => {
    await request(appUrl)
      .get('/observe/work')
      .set('x-request-id', 'observe-work-trace')
      .expect(200, {
        value: 6,
        traceId: 'observe-work-trace',
        feature: 'observability-lab',
        manual: true,
      });
    await vi.waitFor(
      () => expect(snapshot('observe-work-trace')).toBeDefined(),
      { timeout: 5000 },
    );
    const flat = spans(snapshot('observe-work-trace')?.t);
    expect(flat.find((span) => span.n === 'lab.compute')).toMatchObject({
      t: { 'lab.operation': 'sum', 'lab.inputCount': 3 },
    });
    expect(flat.some((span) => span.n === 'lab.sum')).toBe(true);
    expect(flat.some((span) => span.c === 'ObservabilityService')).toBe(true);
    const metrics = batches.flatMap((batch) => batch.payload.custom ?? []);
    expect(
      metrics.find((metric) => metric.n === 'typers.lab.operations'),
    ).toMatchObject({ t: 'counter', v: { '{"operation":"work"}': 1 } });
    expect(
      metrics.find((metric) => metric.n === 'typers.lab.active'),
    ).toMatchObject({ t: 'gauge', v: { default: 0 } });
    expect(
      metrics.find((metric) => metric.n === 'typers.lab.duration_ms'),
    ).toMatchObject({ t: 'summary', ct: { default: 1 } });
    expect(batches[0].headers).toMatchObject({
      'x-api-key': 'local-test-key',
      'x-api-secret': 'local-test-secret',
      'content-encoding': 'gzip',
    });
    expect(
      batches.every(
        (batch) => batch.payload.serviceId === 'typers-observe-test',
      ),
    ).toBe(true);
  });

  it('propagates incoming trace ids to an actual downstream HTTP request', async () => {
    await request(appUrl)
      .get('/observe/downstream')
      .set('x-request-id', 'observe-distributed-trace')
      .expect(200, {
        traceId: 'observe-distributed-trace',
        downstream: { receivedTraceId: 'observe-distributed-trace' },
      });
    await vi.waitFor(
      () => expect(snapshot('observe-distributed-trace')).toBeDefined(),
      { timeout: 5000 },
    );
    expect(
      spans(snapshot('observe-distributed-trace')?.t).some(
        (span) => span.n === 'lab.http.downstream',
      ),
    ).toBe(true);
  });

  it('captures handled and unhandled errors without source-code context', async () => {
    await request(appUrl)
      .get('/observe/handled-error')
      .set('x-request-id', 'observe-handled')
      .expect(200);
    await request(appUrl)
      .get('/observe/error')
      .set('x-request-id', 'observe-unhandled')
      .expect(500);
    await vi.waitFor(
      () => expect(snapshot('observe-unhandled')).toBeDefined(),
      { timeout: 5000 },
    );
    expect(JSON.stringify(snapshot('observe-handled'))).toContain(
      'Handled laboratory failure',
    );
    expect(JSON.stringify(snapshot('observe-unhandled'))).toContain(
      'Unhandled laboratory failure',
    );
    expect(JSON.stringify(snapshot('observe-unhandled'))).not.toMatch(
      /preContext|postContext|contextLine/,
    );
    expect(snapshot('observe-unhandled')?.a?.sc).toBe(500);
  });

  it('redacts secrets before forwarding logs and request URLs', async () => {
    await request(appUrl)
      .get('/observe/log')
      .set('x-request-id', 'observe-log-trace')
      .expect(200);
    await request(appUrl)
      .get('/observe/work?token=query-secret-to-redact')
      .set('x-request-id', 'observe-url-trace')
      .expect(200);
    await vi.waitFor(
      () => expect(snapshot('observe-url-trace')).toBeDefined(),
      { timeout: 5000 },
    );
    const log = batches
      .flatMap((batch) => batch.payload.logs ?? [])
      .find((entry) => entry.text.includes('Observe redaction demo'));
    expect(log?.traceId).toBe('observe-log-trace');
    expect(log?.text).toContain('[REDACTED]');
    expect(log?.text).not.toContain('observe-local-secret');
    expect(log?.text).not.toContain('demo-local-token');
    expect(JSON.stringify(snapshot('observe-url-trace'))).not.toContain(
      'query-secret-to-redact',
    );
  });

  it('exports runtime metrics and skips an explicitly ignored health route', async () => {
    await request(appUrl)
      .get('/observe/health')
      .set('x-request-id', 'observe-ignored')
      .expect(200);
    await request(appUrl)
      .get('/observe/work')
      .set('x-request-id', 'observe-after-ignore')
      .expect(200);
    await vi.waitFor(
      () => {
        expect(snapshot('observe-after-ignore')).toBeDefined();
        expect(
          batches.some((batch) => batch.payload.runtime !== undefined),
        ).toBe(true);
      },
      { timeout: 35000 },
    );
    expect(snapshot('observe-ignored')).toBeUndefined();
  }, 36000);

  it('exposes a serializable Nest snapshot and uses the exported GraphInspector APIs', async () => {
    const response = await request(devtoolsUrl)
      .get('/devtools/graph')
      .expect(200);
    const graph = response.body as {
      nodes: Record<string, { label: string }>;
      edges: Record<string, unknown>;
      entrypoints: Record<string, { methodName: string }[]>;
    };
    expect(Object.values(graph.nodes).map((node) => node.label)).toContain(
      'DevtoolsGraphService',
    );
    expect(Object.keys(graph.edges).length).toBeGreaterThan(0);
    expect(
      Object.values(graph.entrypoints)
        .flat()
        .map((entry) => entry.methodName),
    ).toContain('graph');
    const inspected = await request(devtoolsUrl)
      .get('/devtools/inspect')
      .expect(200);
    expect(JSON.stringify(inspected.body)).toContain('DevtoolsController');
    expect(JSON.stringify(inspected.body)).toContain('class-to-class');
    expect(JSON.parse(JSON.stringify(graph))).toEqual(graph);
  });

  it('closes both Nest applications and bounds the SDK process lifecycle', async () => {
    // `close` also waits for stdout/stderr, so the lifecycle diagnostic is complete.
    const exited = once(child, 'close');
    child.send('close');
    const [code, signal] = await exited;
    expect(code).toBe(0);
    expect(signal).toBeNull();
    expect(childClosed).toBe(true);
    if (
      childOutput.includes('Worker stopped with exit code 1. Restarting worker')
    ) {
      console.info(
        'Observed @nestjs/observe 0.2.0 worker restart during app.close(); isolated fixture then exited explicitly.',
      );
    }
  }, 6000);
});
