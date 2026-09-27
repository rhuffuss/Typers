import {
  Controller,
  Get,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  GrpcMethod,
  GrpcStreamMethod,
  KafkaContext,
  MessagePattern,
  MqttContext,
  NatsContext,
  Payload,
  RedisContext,
  RmqContext,
  TcpContext,
} from '@nestjs/microservices';
import { from, map, Observable, reduce } from 'rxjs';
import { CreatedMessage, SumMessage } from './message.dto.js';
import { MessageLogService } from './message-log.service.js';
import {
  RpcDemoFilter,
  RpcDemoGuard,
  RpcDemoInterceptor,
  RpcDemoPipe,
  rpcTrace,
} from './rpc-context.js';

export const SUM_PATTERN = 'demo.sum';
export const CREATED_PATTERN = 'demo.created';

export async function acknowledgeMessage(
  context: unknown,
): Promise<{ transport: string; acknowledged: boolean }> {
  if (context instanceof RmqContext) {
    const channel = context.getChannelRef() as { ack(message: unknown): void };
    channel.ack(context.getMessage());
    return { transport: 'rabbitmq', acknowledged: true };
  }
  if (context instanceof KafkaContext) {
    const message = context.getMessage();
    await context.getConsumer().commitOffsets([
      {
        topic: context.getTopic(),
        partition: context.getPartition(),
        offset: (BigInt(message.offset) + 1n).toString(),
      },
    ]);
    return { transport: 'kafka', acknowledged: true };
  }
  if (context instanceof NatsContext)
    return { transport: 'nats', acknowledged: false };
  if (context instanceof MqttContext)
    return { transport: 'mqtt', acknowledged: false };
  if (context instanceof RedisContext)
    return { transport: 'redis', acknowledged: false };
  return {
    transport: context instanceof TcpContext ? 'tcp' : 'custom',
    acknowledged: false,
  };
}

@Controller()
@UseGuards(RpcDemoGuard)
@UsePipes(RpcDemoPipe)
@UseInterceptors(RpcDemoInterceptor)
@UseFilters(RpcDemoFilter)
export class MessagingController {
  constructor(private readonly messages: MessageLogService) {}

  @MessagePattern(SUM_PATTERN)
  async sum(@Payload() data: SumMessage, @Ctx() context: unknown) {
    rpcTrace.getStore()?.stages.push('handler');
    const result = data.values.reduce((total, value) => total + value, 0);
    const receipt = await acknowledgeMessage(context);
    return {
      result,
      ...receipt,
    };
  }

  @MessagePattern('demo.stream')
  stream(@Payload() data: SumMessage): Observable<{ result: number }> {
    return from(data.values).pipe(map((result) => ({ result })));
  }

  @MessagePattern('demo.never')
  never(): Observable<never> {
    return new Observable();
  }

  @EventPattern(CREATED_PATTERN)
  async created(
    @Payload() data: CreatedMessage,
    @Ctx() context: unknown,
  ): Promise<void> {
    const receipt = await acknowledgeMessage(context);
    this.messages.record({ id: data.id, value: data.value, ...receipt });
  }
}

@Controller('messaging')
export class MessagingHttpController {
  constructor(private readonly messages: MessageLogService) {}

  @Get('status')
  status() {
    return { transport: 'http', events: this.messages.list() };
  }
}

@Controller()
export class GrpcDemoController {
  @GrpcMethod('Calculator', 'Sum')
  sum(data: SumMessage): { result: number } {
    return { result: data.values.reduce((total, value) => total + value, 0) };
  }

  @GrpcMethod('Calculator', 'Numbers')
  numbers(data: SumMessage): Observable<{ result: number }> {
    return from(data.values).pipe(map((result) => ({ result })));
  }

  @GrpcStreamMethod('Calculator', 'Accumulate')
  accumulate(
    messages: Observable<{ value: number }>,
  ): Observable<{ result: number }> {
    return messages.pipe(
      reduce((total, message) => total + message.value, 0),
      map((result) => ({ result })),
    );
  }

  @GrpcStreamMethod('Calculator', 'Double')
  double(
    messages: Observable<{ value: number }>,
  ): Observable<{ result: number }> {
    return messages.pipe(map(({ value }) => ({ result: value * 2 })));
  }
}
