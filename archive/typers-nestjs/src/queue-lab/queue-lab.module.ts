import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import {
  BullModule,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import type { Job } from 'bullmq';

export const DEMO_QUEUE = 'typers-calculation';
export const DEMO_FLOW = 'typers-flow';

@Processor(DEMO_QUEUE)
export class CalculationWorker extends WorkerHost {
  readonly completed: string[] = [];

  async process(job: Job<{ values: number[]; failOnce?: boolean }, number>) {
    if (job.data.failOnce && job.attemptsMade === 0)
      throw new Error('Demonstration retry');
    await job.updateProgress(50);
    const children = await job.getChildrenValues<number>();
    const sum = [...job.data.values, ...Object.values(children)].reduce(
      (total, value) => total + value,
      0,
    );
    await job.updateProgress(100);
    return sum;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (job.id) this.completed.push(job.id);
  }
}

@Module({})
export class QueueLabModule {
  static register(options: {
    host: string;
    port: number;
    prefix: string;
  }): DynamicModule {
    return {
      module: QueueLabModule,
      imports: [
        BullModule.forRootAsync({
          useFactory: () => ({
            connection: {
              host: options.host,
              port: options.port,
              maxRetriesPerRequest: null,
            },
            prefix: options.prefix,
          }),
        }),
        BullModule.registerQueue({ name: DEMO_QUEUE }),
        BullModule.registerFlowProducer({ name: DEMO_FLOW }),
      ],
      providers: [CalculationWorker],
      exports: [BullModule, CalculationWorker],
    };
  }
}
