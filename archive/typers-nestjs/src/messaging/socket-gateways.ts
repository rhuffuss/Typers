import {
  Module,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  Ack,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsResponse,
} from '@nestjs/websockets';
import type { Server as SocketIoServer } from 'socket.io';
import { WebSocket } from 'ws';
import type { WebSocketServer as RawServer } from 'ws';
import { from, map } from 'rxjs';
import type { Observable } from 'rxjs';
import { SocketMessage } from './message.dto.js';
import {
  GatewayLifecycle,
  SocketDemoFilter,
  SocketDemoGuard,
  SocketDemoInterceptor,
  socketValidationPipe,
} from './socket-support.js';

@WebSocketGateway({ transports: ['websocket'] })
@UseGuards(SocketDemoGuard)
@UsePipes(socketValidationPipe)
@UseInterceptors(SocketDemoInterceptor)
@UseFilters(SocketDemoFilter)
export class SocketIoDemoGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: SocketIoServer;
  constructor(private readonly lifecycle: GatewayLifecycle) {}

  afterInit(): void {
    this.lifecycle.initialized = true;
  }
  handleConnection(): void {
    this.lifecycle.connections++;
  }
  handleDisconnect(): void {
    this.lifecycle.disconnections++;
  }

  @SubscribeMessage('echo')
  echo(@MessageBody() data: SocketMessage) {
    return { text: data.text };
  }

  @SubscribeMessage('explicit-ack')
  explicitAck(
    @MessageBody() data: SocketMessage,
    @Ack() ack: (data: unknown) => void,
  ): void {
    ack({ text: data.text, explicit: true });
  }

  @SubscribeMessage('announce')
  announce(@MessageBody() data: SocketMessage) {
    this.server.emit('broadcast', { text: data.text });
    return { delivered: true };
  }

  @SubscribeMessage('stream')
  stream(
    @MessageBody() data: SocketMessage,
  ): Observable<WsResponse<{ text: string }>> {
    return from(data.text.split(' ')).pipe(
      map((text) => ({ event: 'word', data: { text } })),
    );
  }
}

@WebSocketGateway({ path: '/ws' })
@UseGuards(SocketDemoGuard)
@UsePipes(socketValidationPipe)
@UseInterceptors(SocketDemoInterceptor)
@UseFilters(SocketDemoFilter)
export class RawWsDemoGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: RawServer;
  constructor(private readonly lifecycle: GatewayLifecycle) {}

  afterInit(): void {
    this.lifecycle.initialized = true;
  }
  handleConnection(): void {
    this.lifecycle.connections++;
  }
  handleDisconnect(): void {
    this.lifecycle.disconnections++;
  }

  @SubscribeMessage('echo')
  echo(@MessageBody() data: SocketMessage): WsResponse<{ text: string }> {
    return { event: 'reply', data: { text: data.text } };
  }

  @SubscribeMessage('announce')
  announce(
    @MessageBody() data: SocketMessage,
  ): WsResponse<{ delivered: boolean }> {
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN)
        client.send(
          JSON.stringify({ event: 'broadcast', data: { text: data.text } }),
        );
    }
    return { event: 'announced', data: { delivered: true } };
  }

  @SubscribeMessage('stream')
  stream(
    @MessageBody() data: SocketMessage,
  ): Observable<WsResponse<{ text: string }>> {
    return from(data.text.split(' ')).pipe(
      map((text) => ({ event: 'word', data: { text } })),
    );
  }
}

const enhancers = [
  SocketDemoGuard,
  SocketDemoFilter,
  SocketDemoInterceptor,
  GatewayLifecycle,
];

@Module({ providers: [SocketIoDemoGateway, ...enhancers] })
export class SocketIoMessagingModule {}

@Module({ providers: [RawWsDemoGateway, ...enhancers] })
export class RawWsMessagingModule {}
