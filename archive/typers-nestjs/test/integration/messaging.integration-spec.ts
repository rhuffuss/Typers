import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestMicroservice } from '@nestjs/common';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom, timeout } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BROKERS,
  brokerOptions,
  brokerEventPayload,
  createBrokerClient,
  prepareKafkaTopics,
} from '../../src/messaging/broker-options.js';
import type { DemoMessageClient } from '../../src/messaging/broker-options.js';
import { MessageLogService } from '../../src/messaging/message-log.service.js';
import {
  CREATED_PATTERN,
  SUM_PATTERN,
} from '../../src/messaging/messaging.controller.js';
import { MessagingModule } from '../../src/messaging/messaging.module.js';
import { registerRpcHooks } from '../../src/messaging/rpc-context.js';

const selected = process.env.MESSAGING_BROKERS?.split(',') ?? [...BROKERS];

for (const broker of BROKERS) {
  describe.runIf(
    process.env.RUN_BROKER_INTEGRATION === '1' && selected.includes(broker),
  )(`Broker real: ${broker}`, () => {
    let app: INestMicroservice;
    let client: DemoMessageClient;

    beforeAll(async () => {
      if (broker === 'kafka') await prepareKafkaTopics();
      const runId = randomUUID();
      app = await NestFactory.createMicroservice<MicroserviceOptions>(
        MessagingModule,
        {
          ...brokerOptions(broker, runId),
          logger: ['error'],
        },
      );
      registerRpcHooks(app);
      await app.listen();
      client = createBrokerClient(broker, runId);
      await client.connect();
    }, 60_000);

    afterAll(async () => {
      await client?.close();
      await app?.close();
    }, 30_000);

    it('completes a real request-response through the selected broker', async () => {
      const result = await firstValueFrom(
        client
          .send(SUM_PATTERN, {
            values: [3, 4],
            correlationId: `broker-${broker}`,
          })
          .pipe(timeout(15_000)),
      );
      expect(result).toMatchObject({
        result: 7,
        transport: broker,
        acknowledged: broker === 'rabbitmq' || broker === 'kafka',
        correlationId: `broker-${broker}`,
      });
    }, 20_000);

    it('delivers and records an event, acknowledging where the transport supports it', async () => {
      const id = randomUUID();
      await lastValueFrom(
        client
          .emit(
            CREATED_PATTERN,
            brokerEventPayload(broker, { id, value: broker }),
          )
          .pipe(timeout(15_000)),
      );
      await expect
        .poll(() => app.get(MessageLogService).get(id), { timeout: 15_000 })
        .toEqual({
          id,
          value: broker,
          transport: broker,
          acknowledged: broker === 'rabbitmq' || broker === 'kafka',
        });
    }, 20_000);
  });
}
