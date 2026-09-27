import { createServer } from 'node:http';
import type {
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { BaseRpcContext, ClientProxy, Server } from '@nestjs/microservices';
import type {
  CustomTransportStrategy,
  ReadPacket,
  WritePacket,
} from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

export class HttpRpcContext extends BaseRpcContext<[IncomingMessage]> {}

/** A small real HTTP/NDJSON transport for testing the Nest transporter API. */
export class HttpRpcServer
  extends Server<Record<string, (...args: unknown[]) => void>>
  implements CustomTransportStrategy
{
  private readonly http: HttpServer;

  constructor() {
    super();
    this.http = createServer((request, response) => {
      void this.receive(request, response).catch((error: unknown) => {
        if (!response.writableEnded) {
          response.writeHead(400, { 'content-type': 'application/x-ndjson' });
          response.end(
            JSON.stringify({
              err: error instanceof Error ? error.message : 'Transport error',
              isDisposed: true,
            }) + '\n',
          );
        }
      });
    });
  }

  listen(callback: (...args: unknown[]) => void): void {
    this.http.once('error', callback);
    this.http.listen(0, '127.0.0.1', () => {
      this.http.off('error', callback);
      callback();
    });
  }

  get url(): string {
    return `http://127.0.0.1:${(this.http.address() as AddressInfo).port}`;
  }

  async close(): Promise<void> {
    this.http.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      this.http.close((error) => (error ? reject(error) : resolve())),
    );
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    this.http.on(event, callback);
  }
  unwrap<T>(): T {
    return this.http as T;
  }

  private async receive(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== 'POST' || request.url !== '/') {
      response.writeHead(404).end();
      return;
    }
    let body = '';
    for await (const chunk of request) {
      body += String(chunk);
      if (Buffer.byteLength(body) > 65_536)
        throw new Error('Message exceeds 64 KiB');
    }
    const packet = JSON.parse(body) as ReadPacket & { id?: string };
    if (typeof packet.pattern !== 'string')
      throw new Error('String pattern required');
    const handler = this.getHandlerByPattern(packet.pattern);
    response.setHeader('content-type', 'application/x-ndjson');
    if (!handler) {
      response.end(
        JSON.stringify({ err: 'NO_HANDLER', isDisposed: true }) + '\n',
      );
      return;
    }
    const context = new HttpRpcContext([request]);
    const stream = this.transformToObservable(
      await handler(packet.data, context),
    );
    if (!packet.id) {
      await lastValueFrom(stream, { defaultValue: undefined });
      response.writeHead(202).end();
      return;
    }
    const subscription = this.send(stream, (value) => {
      if (response.destroyed) return;
      response.write(JSON.stringify(value) + '\n');
      if (value.isDisposed) response.end();
    });
    response.on('close', () => subscription.unsubscribe());
  }
}

export class HttpRpcClient extends ClientProxy {
  private readonly pending = new Set<AbortController>();

  constructor(private readonly url: string) {
    super();
  }
  connect(): Promise<string> {
    return Promise.resolve(this.url);
  }
  close(): void {
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
  }
  unwrap<T>(): T {
    return this.url as T;
  }

  protected publish(
    packet: ReadPacket,
    callback: (packet: WritePacket) => void,
  ): () => void {
    const controller = new AbortController();
    this.pending.add(controller);
    void (async () => {
      const response = await fetch(this.url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.assignPacketId(packet)),
      });
      if (!response.body) throw new Error('Missing response body');
      let pending = '';
      for await (const chunk of response.body.pipeThrough(
        new TextDecoderStream(),
      )) {
        pending += chunk;
        let newline: number;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          if (line) callback(JSON.parse(line) as WritePacket);
        }
      }
    })()
      .catch((err: unknown) => {
        if (!controller.signal.aborted) callback({ err });
      })
      .finally(() => this.pending.delete(controller));
    return () => {
      controller.abort();
      this.pending.delete(controller);
    };
  }

  protected async dispatchEvent<T>(packet: ReadPacket): Promise<T> {
    const controller = new AbortController();
    this.pending.add(controller);
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(packet),
      });
      if (response.status !== 202) throw new Error(await response.text());
      return undefined as T;
    } finally {
      this.pending.delete(controller);
    }
  }
}
