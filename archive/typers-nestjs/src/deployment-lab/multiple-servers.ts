import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import {
  createServer as createHttpServer,
  type RequestListener,
  type Server as HttpServer,
} from 'node:http';
import {
  createServer as createHttpsServer,
  type Server as HttpsServer,
} from 'node:https';
import { DeploymentLabModule } from './deployment.module.js';

export interface MultipleServersOptions {
  key: Buffer;
  cert: Buffer;
  httpPort?: number;
  httpsPort?: number;
  keepAliveTimeout?: number;
}

export function configureKeepAlive(
  server: HttpServer | HttpsServer,
  timeout = 5000,
): void {
  if (!Number.isInteger(timeout) || timeout < 1)
    throw new Error('keepAliveTimeout must be a positive integer');
  server.keepAliveTimeout = timeout;
  server.headersTimeout = timeout + 1000;
}

async function listen(
  server: HttpServer | HttpsServer,
  port: number,
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Server did not bind a TCP port');
  return address.port;
}

async function closeServer(server: HttpServer | HttpsServer): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

export async function createMultipleServers(
  options: MultipleServersOptions,
): Promise<{
  app: NestExpressApplication;
  httpServer: HttpServer;
  httpsServer: HttpsServer;
  httpUrl: string;
  httpsUrl: string;
  close: () => Promise<void>;
}> {
  const adapter = new ExpressAdapter();
  const app = await NestFactory.create<NestExpressApplication>(
    DeploymentLabModule,
    adapter,
    { logger: false, abortOnError: false },
  );
  let httpServer: HttpServer | undefined;
  let httpsServer: HttpsServer | undefined;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await Promise.all([
        httpServer ? closeServer(httpServer) : Promise.resolve(),
        httpsServer ? closeServer(httpsServer) : Promise.resolve(),
      ]);
    } finally {
      await app.close();
    }
  };
  try {
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    const listener = adapter.getInstance() as RequestListener;
    httpServer = createHttpServer(listener);
    httpsServer = createHttpsServer(
      { key: options.key, cert: options.cert, minVersion: 'TLSv1.2' },
      listener,
    );
    configureKeepAlive(httpServer, options.keepAliveTimeout);
    configureKeepAlive(httpsServer, options.keepAliveTimeout);
    // Both Node servers dispatch to the same initialized Nest/Express listener.
    // Sequential binding also makes cleanup deterministic if the second port fails.
    const httpPort = await listen(httpServer, options.httpPort ?? 0);
    const httpsPort = await listen(httpsServer, options.httpsPort ?? 0);
    return {
      app,
      httpServer,
      httpsServer,
      httpUrl: `http://127.0.0.1:${httpPort}`,
      httpsUrl: `https://127.0.0.1:${httpsPort}`,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
