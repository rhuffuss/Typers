import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { CircularDemoModule } from './circular-demo.module.js';
import { DemoContextGuard, DemoContextInterceptor } from './demo-context.js';
import {
  DemoSettingsModule,
  DemoSettingsService,
} from './demo-settings.module.js';
import {
  FundamentalsController,
  FundamentalsScopesController,
} from './fundamentals.controller.js';
import { FundamentalsService } from './fundamentals.service.js';
import {
  ASYNC_CATALOG,
  DEMO_NAME,
  GREETING,
  GREETING_ALIAS,
} from './fundamentals.tokens.js';
import type { PreparedCatalog } from './fundamentals.tokens.js';
import { GreetingService } from './greeting.service.js';
import { LifecycleProbeService } from './lifecycle-probe.service.js';
import {
  FirstConsumer,
  RequestProbe,
  SecondConsumer,
  SingletonProbe,
  TransientProbe,
} from './scope-probes.js';

@Module({
  imports: [
    DiscoveryModule,
    CircularDemoModule,
    DemoSettingsModule.forRootAsync({
      useFactory: () =>
        Promise.resolve({
          label: 'Fundamentals laboratory',
          mode: 'demo' as const,
        }),
    }),
  ],
  controllers: [FundamentalsController, FundamentalsScopesController],
  providers: [
    { provide: DEMO_NAME, useValue: 'typers-nestjs' },
    { provide: GREETING, useClass: GreetingService },
    { provide: GREETING_ALIAS, useExisting: GREETING },
    {
      provide: ASYNC_CATALOG,
      inject: [DEMO_NAME, DemoSettingsService],
      useFactory: async (
        name: string,
        settings: DemoSettingsService,
      ): Promise<PreparedCatalog> => {
        const entries = await Promise.resolve([
          'providers',
          'scopes',
          settings.options.mode,
        ]);
        return Object.freeze({
          ready: true,
          name,
          entries: Object.freeze(entries),
        });
      },
    },
    FundamentalsService,
    LifecycleProbeService,
    SingletonProbe,
    RequestProbe,
    TransientProbe,
    FirstConsumer,
    SecondConsumer,
    DemoContextGuard,
    DemoContextInterceptor,
  ],
  exports: [FundamentalsService, LifecycleProbeService],
})
export class FundamentalsModule {}
