import { Module } from '@nestjs/common';
import {
  GrpcDemoController,
  MessagingController,
  MessagingHttpController,
} from './messaging.controller.js';
import { MessageLogService } from './message-log.service.js';
import {
  RpcDemoFilter,
  RpcDemoGuard,
  RpcDemoInterceptor,
  RpcDemoPipe,
} from './rpc-context.js';

@Module({
  controllers: [
    MessagingController,
    MessagingHttpController,
    GrpcDemoController,
  ],
  providers: [
    MessageLogService,
    RpcDemoGuard,
    RpcDemoPipe,
    RpcDemoInterceptor,
    RpcDemoFilter,
  ],
  exports: [MessageLogService],
})
export class MessagingModule {}
