import { ContextIdFactory, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { FundamentalsAdvancedModule } from './fundamentals-advanced.module.js';
import type { AdvancedDiOptions } from './fundamentals-advanced.module.js';
import {
  AllowedTenantContextStrategy,
  IndependentRequestContextStrategy,
} from './tenant-context.js';

let activeLab = false;

/** ContextIdFactory is process-global: run this harness in a dedicated process. */
export async function createAdvancedDiLab(options: AdvancedDiOptions = {}) {
  if (activeLab)
    throw new Error(
      'Only one advanced DI harness can own the process context strategy',
    );
  activeLab = true;
  const strategy = new AllowedTenantContextStrategy();
  ContextIdFactory.apply(strategy);
  let app: NestExpressApplication | undefined;
  let closed = false;
  const reset = () => {
    strategy.clear();
    ContextIdFactory.apply(new IndependentRequestContextStrategy());
    activeLab = false;
  };
  try {
    app = await NestFactory.create<NestExpressApplication>(
      FundamentalsAdvancedModule.register(options),
      { logger: false, abortOnError: false },
    );
    app.setGlobalPrefix('api');
    await app.init();
    const application = app;
    return {
      app: application,
      strategy,
      async close() {
        if (closed) return;
        closed = true;
        try {
          await application.close();
        } finally {
          reset();
        }
      },
    };
  } catch (error) {
    try {
      await app?.close();
    } finally {
      reset();
    }
    throw error;
  }
}
