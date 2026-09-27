import { NestFactory } from '@nestjs/core';
import { getFlowProducerToken, getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'node:crypto';
import { QueueEvents } from 'bullmq';
import type { FlowProducer, Queue } from 'bullmq';
import {
  CalculationWorker,
  DEMO_FLOW,
  DEMO_QUEUE,
  QueueLabModule,
} from '../../src/queue-lab/queue-lab.module.js';

describe.skipIf(process.env.RUN_QUEUE_INTEGRATION !== '1')(
  'BullMQ real Redis',
  () => {
    it('processes jobs, retries a known failure and joins a parent/children flow', async () => {
      const prefix = `typers-${randomUUID()}`;
      const connection = {
        host: '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 56379),
      };
      const app = await NestFactory.createApplicationContext(
        QueueLabModule.register({ ...connection, prefix }),
        { logger: false },
      );
      const queue = app.get<Queue>(getQueueToken(DEMO_QUEUE));
      const events = new QueueEvents(DEMO_QUEUE, { connection, prefix });
      try {
        await events.waitUntilReady();
        const job = await queue.add(
          'retry-sum',
          { values: [2, 3], failOnce: true },
          { attempts: 2, backoff: 10 },
        );
        expect(await job.waitUntilFinished(events, 10000)).toBe(5);
        const stored = await queue.getJob(job.id!);
        expect(stored?.attemptsMade).toBe(2);
        expect(stored?.progress).toBe(100);
        const producer = app.get<FlowProducer>(getFlowProducerToken(DEMO_FLOW));
        const flow = await producer.add({
          name: 'sum-parent',
          queueName: DEMO_QUEUE,
          data: { values: [1] },
          children: [
            {
              name: 'sum-child',
              queueName: DEMO_QUEUE,
              data: { values: [4, 5] },
            },
          ],
        });
        expect(await flow.job.waitUntilFinished(events, 10000)).toBe(10);
        await vi.waitFor(() =>
          expect(
            app.get(CalculationWorker).completed.length,
          ).toBeGreaterThanOrEqual(3),
        );
      } finally {
        await events.close();
        await queue.obliterate({ force: true });
        await app.close();
      }
    });
  },
);
