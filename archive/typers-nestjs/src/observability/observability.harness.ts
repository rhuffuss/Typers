import { ConsoleLogger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createObserveModule, type ObserveOptions } from '@nestjs/observe';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ObservabilityController } from './observability.controller.js';
import {
  OBSERVE_LAB_OPTIONS,
  type ObserveLabOptions,
  ObservabilityService,
} from './observability.service.js';

export async function createObservabilityApp(
  options: ObserveOptions & ObserveLabOptions,
): Promise<NestExpressApplication> {
  const { ObserveModule, ObserveInstrument } = createObserveModule({
    sourceContext: false,
    attachTraceIdToLogs: true,
  });

  @Module({
    imports: [
      ObserveModule.forRootAsync({
        useFactory: () => ({
          ...options,
          tracesSampleRate: 1,
          forwardLogs: true,
          redaction: {
            enabled: true,
            keys: ['internalToken'],
            patterns: [/observe-local-secret/g],
          },
          http: {
            ignore: ['/observe/health'],
            tags: { project: 'typers', example: 'observability' },
          },
        }),
      }),
    ],
    controllers: [ObservabilityController],
    providers: [
      ObservabilityService,
      {
        provide: OBSERVE_LAB_OPTIONS,
        useValue: { upstreamUrl: options.upstreamUrl },
      },
    ],
  })
  class ObservabilityLabModule {}

  return NestFactory.create<NestExpressApplication>(ObservabilityLabModule, {
    instrument: ObserveInstrument,
    logger: new ConsoleLogger({ json: true, colors: false }),
    abortOnError: false,
    snapshot: true,
  });
}
