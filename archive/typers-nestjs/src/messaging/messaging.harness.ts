import { createServer } from 'node:net';
import type { AddressInfo, Server as NetServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { ClientGrpc, MicroserviceOptions } from '@nestjs/microservices';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WsAdapter } from '@nestjs/platform-ws';
import type { Observable } from 'rxjs';
import { HttpRpcClient, HttpRpcServer } from './http-rpc.transport.js';
import { MessagingModule } from './messaging.module.js';
import { registerRpcHooks } from './rpc-context.js';
import {
  RawWsMessagingModule,
  SocketIoMessagingModule,
} from './socket-gateways.js';

export async function startTcpDemo() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MessagingModule,
    {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
      logger: false,
    },
  );
  registerRpcHooks(app);
  await app.listen();
  const port = (app.unwrap<NetServer>().address() as AddressInfo).port;
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port },
  });
  await client.connect();
  return {
    app,
    client,
    close: async () => {
      client.close();
      await app.close();
    },
  };
}

export async function startHybridDemo() {
  const app = await NestFactory.create(MessagingModule, { logger: false });
  const microservice = app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    },
    { inheritAppConfig: true },
  );
  registerRpcHooks(microservice);
  await app.startAllMicroservices();
  await app.listen(0, '127.0.0.1');
  const port = (microservice.unwrap<NetServer>().address() as AddressInfo).port;
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port },
  });
  await client.connect();
  return {
    app,
    client,
    url: await app.getUrl(),
    close: async () => {
      client.close();
      await app.close();
    },
  };
}

export async function startCustomTransportDemo() {
  const strategy = new HttpRpcServer();
  const app = await NestFactory.createMicroservice(MessagingModule, {
    strategy,
    logger: false,
  });
  registerRpcHooks(app);
  await app.listen();
  const client = new HttpRpcClient(strategy.url);
  await client.connect();
  return {
    app,
    client,
    close: async () => {
      client.close();
      await app.close();
    },
  };
}

// Nest's gRPC options take an address string and do not return the bound port.
// Reserve an OS-selected port briefly, release it, then bind gRPC to that port.
async function availablePort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

export interface CalculatorGrpc {
  sum(data: { values: number[] }): Observable<{ result: number }>;
  numbers(data: { values: number[] }): Observable<{ result: number }>;
  accumulate(
    data: Observable<{ value: number }>,
  ): Observable<{ result: number }>;
  double(data: Observable<{ value: number }>): Observable<{ result: number }>;
}

export async function startGrpcDemo() {
  const port = await availablePort();
  const options = {
    package: 'typers.demo',
    protoPath: fileURLToPath(new URL('./calculator.proto', import.meta.url)),
    url: `127.0.0.1:${port}`,
  };
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MessagingModule,
    {
      transport: Transport.GRPC,
      options,
      logger: false,
    },
  );
  await app.listen();
  const client = ClientProxyFactory.create({
    transport: Transport.GRPC,
    options,
  });
  const calculator = (
    client as unknown as ClientGrpc
  ).getService<CalculatorGrpc>('Calculator');
  return {
    app,
    calculator,
    close: async () => {
      client.close();
      await app.close();
    },
  };
}

export async function startSocketDemo(adapter: 'socket.io' | 'ws') {
  const module =
    adapter === 'socket.io' ? SocketIoMessagingModule : RawWsMessagingModule;
  const app = await NestFactory.create(module, { logger: false });
  app.useWebSocketAdapter(
    adapter === 'socket.io' ? new IoAdapter(app) : new WsAdapter(app),
  );
  await app.listen(0, '127.0.0.1');
  return { app, url: await app.getUrl(), close: () => app.close() };
}
