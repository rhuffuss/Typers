import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DemoEnvelope } from '../src/fundamentals/demo-context.js';
import { FundamentalsController } from '../src/fundamentals/fundamentals.controller.js';
import { FundamentalsModule } from '../src/fundamentals/fundamentals.module.js';
import { FundamentalsService } from '../src/fundamentals/fundamentals.service.js';
import { DEMO_NAME } from '../src/fundamentals/fundamentals.tokens.js';
import { LifecycleProbeService } from '../src/fundamentals/lifecycle-probe.service.js';

type Summary = ReturnType<FundamentalsService['summary']>;
type Scopes = Awaited<ReturnType<FundamentalsService['scopes']>>;
type LazyReport = Awaited<ReturnType<FundamentalsService['lazy']>>;
type Discovered = ReturnType<FundamentalsService['discovery']>;

describe('Fundamentals (real Nest application)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [FundamentalsModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function read<T>(
    path: string,
    headers?: Record<string, string>,
  ): Promise<DemoEnvelope<T>> {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    expect(response.status).toBe(200);
    return response.json() as Promise<DemoEnvelope<T>>;
  }

  it('preserves emitted constructor metadata used by class injection', () => {
    expect(
      Reflect.getMetadata('design:paramtypes', FundamentalsController),
    ).toEqual([FundamentalsService]);
  });

  it('awaits factories and dynamic configuration, and aliases the same provider', async () => {
    const { data, context } = await read<Summary>('/fundamentals');
    expect(data).toMatchObject({
      name: 'typers-nestjs',
      greeting: 'Hello, typers-nestjs!',
      aliasIsSameInstance: true,
      catalog: {
        ready: true,
        name: 'typers-nestjs',
        entries: ['providers', 'scopes', 'demo'],
      },
      settings: { label: 'Fundamentals laboratory', mode: 'demo' },
      lifecycle: ['onModuleInit', 'onApplicationBootstrap'],
    });
    expect(context).toEqual({
      transport: 'http',
      controller: 'FundamentalsController',
      handler: 'summary',
      access: 'public',
    });
  });

  it('resolves both directions of the isolated forwardRef provider cycle', async () => {
    const { data } = await read<Summary>('/fundamentals');
    expect(data.circular).toEqual({
      peers: ['first', 'second'],
      firstPointsToSecond: true,
      secondPointsToFirst: true,
      roundTripPreservesIdentity: true,
    });
  });

  it('shares singletons, isolates requests and consumers, and reuses explicit contexts', async () => {
    const first = (await read<Scopes>('/fundamentals/scopes')).data;
    const second = (await read<Scopes>('/fundamentals/scopes')).data;

    expect(first.singleton).toMatchObject({
      sameViaGet: true,
      sameInCreatedClass: true,
    });
    expect(first.singleton.id).toBe(second.singleton.id);
    expect(first.request).toMatchObject({
      sameWithinRequest: true,
      sameWithinManualContext: true,
      differentContexts: true,
      registeredRequestSource: 'manual-context',
    });
    expect(first.request.id).not.toBe(second.request.id);
    expect(first.request.manualId).not.toBe(second.request.manualId);
    expect(first.transient).toMatchObject({
      differentConsumers: true,
      differentImplicitContexts: true,
      sameExplicitContext: true,
    });
    expect(first.transient.firstConsumerId).toBe(
      second.transient.firstConsumerId,
    );
    expect(first.transient.firstConsumerId).not.toBe(
      first.transient.secondConsumerId,
    );
  });

  it('caches a lazy module and leaves its documented lifecycle hook uncalled', async () => {
    const first = (await read<LazyReport>('/fundamentals/lazy')).data;
    const second = (await read<LazyReport>('/fundamentals/lazy')).data;
    expect(first.message).toBe('Provider loaded on demand');
    expect(first.id).toBe(second.id);
    expect(first.moduleInitCalled).toBe(false);
  });

  it('discovers a decorated provider and both registered controllers', async () => {
    const { data } = await read<Discovered>('/fundamentals/discovery');
    expect(data.providers).toContainEqual({
      feature: 'greeting',
      provider: 'GreetingService',
    });
    expect(data.controllers).toEqual([
      'FundamentalsController',
      'FundamentalsScopesController',
    ]);
  });

  it('applies method metadata before class metadata in the guard and interceptor', async () => {
    const denied = await fetch(`${baseUrl}/fundamentals/context`);
    expect(denied.status).toBe(403);
    const allowed = await read<{ message: string }>('/fundamentals/context', {
      'x-demo-access': 'acknowledged',
    });
    expect(allowed.context.access).toBe('acknowledged');
    expect(allowed.context.handler).toBe('context');
    expect(allowed.data.message).toContain('overrides');
  });

  it('supports overriding a token while its async dependent is still resolved by Nest', async () => {
    const module = await Test.createTestingModule({
      imports: [FundamentalsModule],
    })
      .overrideProvider(DEMO_NAME)
      .useValue('test-consumer')
      .compile();
    try {
      const summary = module.get(FundamentalsService).summary();
      expect(summary.greeting).toBe('Hello, test-consumer!');
      expect(summary.catalog.name).toBe('test-consumer');
      expect(summary.aliasIsSameInstance).toBe(true);
    } finally {
      await module.close();
    }
  });

  it('runs startup and shutdown lifecycle hooks through app.init and app.close', async () => {
    const module = await Test.createTestingModule({
      imports: [FundamentalsModule],
    }).compile();
    const closingApp = module.createNestApplication({ logger: false });
    const probe = closingApp.get(LifecycleProbeService);
    try {
      expect(probe.snapshot()).toEqual([]);
      await closingApp.init();
      expect(probe.snapshot()).toEqual([
        'onModuleInit',
        'onApplicationBootstrap',
      ]);
    } finally {
      await closingApp.close();
    }
    expect(probe.snapshot()).toEqual([
      'onModuleInit',
      'onApplicationBootstrap',
      'onModuleDestroy',
      'beforeApplicationShutdown',
      'onApplicationShutdown',
    ]);
  });
});
