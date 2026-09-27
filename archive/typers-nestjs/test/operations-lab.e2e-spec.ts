import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { VersioningOptions } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OperationsLabModule } from '../src/operations-lab/operations-lab.module.js';
import { operationsConfig } from '../src/operations-lab/operations.config.js';
import { ReservationEngine } from '../src/operations-lab/reservation-engine.js';

async function createLab(
  versioning: VersioningOptions = {
    type: VersioningType.URI,
    defaultVersion: '2',
  },
) {
  const module = await Test.createTestingModule({
    imports: [OperationsLabModule],
  }).compile();
  const app = module.createNestApplication();
  app.enableVersioning(versioning);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('Operations: typed configuration, dynamic scheduling and version contracts', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('injects a namespaced ConfigType through asProvider and rejects inventory oversubscription', async () => {
    vi.stubEnv('LAB_OPERATIONS_CAPACITY', '8');
    const app = await createLab();
    try {
      const engine = app.get(ReservationEngine);
      expect(engine.policy).toEqual(app.get(operationsConfig.KEY));
      engine.reserve('first', 5);
      expect(() => engine.reserve('too-many', 4)).toThrow(
        'Insufficient inventory',
      );
      expect(() => engine.reserve('first', 1)).toThrow('cannot be reused');
      expect(() => engine.reserve('bad', 0)).toThrow('Invalid reservation');
      expect(() => engine.reserve('bad', 1, 3600001)).toThrow(
        'Invalid reservation',
      );
      engine.reserve('second', 3);
      expect(engine.used).toBe(8);
    } finally {
      await app.close();
    }
  });

  it('validates HTTP holds, confirms inventory and rejects expired or forged transitions', async () => {
    const app = await createLab();
    try {
      const http = request(app.getHttpServer());
      const held = await http
        .post('/v2/operations/holds')
        .send({ id: 'workshop', units: 3 })
        .expect(201);
      expect(held.body).toMatchObject({
        id: 'workshop',
        units: 3,
        status: 'held',
      });
      const confirmed = await http
        .post('/v1/operations/holds/workshop/confirm')
        .expect(201);
      expect(confirmed.body.status).toBe('confirmed');
      await http.post('/v2/operations/holds/workshop/confirm').expect(409);
      await http
        .post('/v2/operations/holds')
        .send({ id: 'forged', units: 1, status: 'confirmed' })
        .expect(400);
      await http
        .post('/v2/operations/holds')
        .send({ id: 'too-large', units: 101 })
        .expect(409);
      await http
        .post('/v2/operations/holds')
        .send({ id: 'short', units: 1, holdMs: 1 })
        .expect(201);
      await vi.waitFor(() =>
        expect(
          app
            .get(ReservationEngine)
            .list()
            .find((item) => item.id === 'short')?.status,
        ).toBe('expired'),
      );
      await http.post('/v2/operations/holds/short/confirm').expect(409);
    } finally {
      await app.close();
    }
  });

  it('fails bootstrap for an invalid namespaced configuration instead of using a silent default', async () => {
    vi.stubEnv('LAB_OPERATIONS_CAPACITY', 'not-a-number');
    await expect(
      Test.createTestingModule({ imports: [OperationsLabModule] }).compile(),
    ).rejects.toThrow('Operations configuration');
  });

  it('merges two env files with first-file and shell precedence, validates and infers nested keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'typers-config-'));
    const keys = [
      'LAB_ENVIRONMENT_BUDGET',
      'LAB_ENVIRONMENT_LABEL',
      'LAB_ENVIRONMENT_REGION',
    ] as const;
    for (const key of keys) vi.stubEnv(key, undefined);
    vi.stubEnv('LAB_ENVIRONMENT_BUDGET', '900');
    try {
      await writeFile(
        join(directory, 'local.env'),
        'LAB_ENVIRONMENT_BUDGET=300\nLAB_ENVIRONMENT_LABEL=local\n',
      );
      await writeFile(
        join(directory, 'base.env'),
        'LAB_ENVIRONMENT_BUDGET=100\nLAB_ENVIRONMENT_LABEL=base\nLAB_ENVIRONMENT_REGION=eu\n',
      );
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            envFilePath: [
              join(directory, 'local.env'),
              join(directory, 'base.env'),
            ],
            cache: true,
            validate: (env: Record<string, unknown>) => ({
              ...env,
              allocation: { budget: Number(env.LAB_ENVIRONMENT_BUDGET) },
            }),
          }),
        ],
      }).compile();
      try {
        const config = module.get(
          ConfigService<{ allocation: { budget: number } }, true>,
        );
        const budget: number = config.get('allocation.budget', { infer: true });
        expect(budget).toBe(900);
        expect(
          module.get(ConfigService).getOrThrow('LAB_ENVIRONMENT_LABEL'),
        ).toBe('local');
        expect(
          module.get(ConfigService).getOrThrow('LAB_ENVIRONMENT_REGION'),
        ).toBe('eu');
        expect(() =>
          module.get(ConfigService).getOrThrow('LAB_ENVIRONMENT_MISSING'),
        ).toThrow();
      } finally {
        await module.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('expires holds through registered timeouts and cancels the timeout when inventory is confirmed', async () => {
    const app = await createLab();
    try {
      const engine = app.get(ReservationEngine);
      const registry = app.get(SchedulerRegistry);
      engine.reserve('short', 10, 20);
      engine.reserve('paid', 20, 1000);
      expect(
        registry.getTimeout<NodeJS.Timeout>('operations:hold:short'),
      ).toBeDefined();
      expect(engine.confirm('paid').status).toBe('confirmed');
      expect(registry.doesExist('timeout', 'operations:hold:paid')).toBe(false);
      await vi.waitFor(() =>
        expect(engine.list().find((item) => item.id === 'short')?.status).toBe(
          'expired',
        ),
      );
      expect(engine.used).toBe(20);
      expect(registry.getTimeouts()).toEqual([]);
      expect(() => engine.confirm('short')).toThrow('unexpired hold');
      expect(() => engine.confirm('missing')).toThrow('not found');
    } finally {
      await app.close();
    }
  });

  it('recovers an expired hold with a real dynamic cron, reschedules and rejects duplicate jobs', async () => {
    const app = await createLab();
    try {
      const engine = app.get(ReservationEngine);
      const registry = app.get(SchedulerRegistry);
      engine.reserve('reconcile', 7, 10);
      // Simulate loss of the one-shot timer; periodic reconciliation must recover inventory.
      registry.deleteTimeout('operations:hold:reconcile');
      engine.startSweep();
      expect(() => engine.startSweep()).toThrow('already exists');
      const job = registry.getCronJob('operations:sweep');
      expect(registry.getCronJobs().size).toBe(1);
      await vi.waitFor(
        () => {
          expect(engine.metrics().sweepRuns).toBeGreaterThan(0);
          expect(engine.list()[0]?.status).toBe('expired');
        },
        { timeout: 2500 },
      );
      expect(job.lastDate()).toBeInstanceOf(Date);
      expect(engine.used).toBe(0);
      expect(() => engine.rescheduleSweep('bad cron')).toThrow();
      expect(job.isActive).toBe(true);
      engine.rescheduleSweep('0 0 0 1 1 *');
      expect(job.nextDates(2)).toHaveLength(2);
      await job.stop();
      expect(job.isActive).toBe(false);
      job.start();
      expect(job.isActive).toBe(true);
      engine.stopSweep();
      expect(registry.doesExist('cron', 'operations:sweep')).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('samples bounded inventory history with a dynamic interval and removes all timers on application close', async () => {
    const app = await createLab();
    const engine = app.get(ReservationEngine);
    const registry = app.get(SchedulerRegistry);
    try {
      engine.reserve('held', 12);
      engine.startSampling(10);
      expect(() => engine.startSampling(10)).toThrow('already exists');
      expect(() => engine.startSampling(0)).toThrow('Sampling interval');
      expect(
        registry.getInterval<NodeJS.Timeout>('operations:capacity'),
      ).toBeDefined();
      expect(registry.getIntervals()).toEqual(['operations:capacity']);
      await vi.waitFor(() => expect(engine.metrics().samples).toHaveLength(8));
      expect(engine.metrics().samples).toEqual(Array<number>(8).fill(12));
      engine.stopSampling();
      expect(registry.getIntervals()).toEqual([]);
      engine.startSampling(10);
      engine.startSweep();
      await app.close();
      expect(registry.getIntervals()).toEqual([]);
      expect(registry.getTimeouts()).toEqual([]);
      expect(registry.getCronJobs().size).toBe(0);
      const final = engine.metrics();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(engine.metrics()).toEqual(final);
    } finally {
      await app.close();
    }
  });

  it('serves URI-neutral, multiple-version and default-version routes with version-specific middleware', async () => {
    const app = await createLab();
    try {
      const http = request(app.getHttpServer());
      const v1 = await http
        .get('/v1/operations/summary')
        .expect(200, { used: 0 });
      expect(v1.headers['x-inventory-contract']).toBeUndefined();
      await http
        .get('/v2/operations/summary')
        .expect('x-inventory-contract', '2')
        .expect(200, { inventory: { used: 0, capacity: 100 } });
      for (const version of ['1', '2']) {
        await http
          .get(`/v${version}/operations/policy`)
          .expect(200, { capacity: 100, holdMs: 60000 });
      }
      await http.get('/operations/status').expect(200, { status: 'ready' });
      await http.get('/v1/operations/status').expect(404);
      await http.get('/v3/operations/policy').expect(404);
      await http.get('/operations-capabilities').expect(404);
      await http.get('/v2/operations-capabilities').expect(200);
    } finally {
      await app.close();
    }
  });

  it('serves header-neutral routes with or without an unknown version and rejects an unsupported policy version', async () => {
    const app = await createLab({
      type: VersioningType.HEADER,
      header: 'x-api-version',
    });
    try {
      const http = request(app.getHttpServer());
      await http.get('/operations/status').expect(200);
      await http
        .get('/operations/status')
        .set('x-api-version', '999')
        .expect(200);
      await http
        .get('/operations/policy')
        .set('x-api-version', '2')
        .expect(200);
      await http
        .get('/operations/policy')
        .set('x-api-version', '999')
        .expect(404);
      await http.get('/operations/policy').expect(404);
    } finally {
      await app.close();
    }
  });

  it('selects the highest supported custom version on Fastify from an ordered client preference list', async () => {
    const module = await Test.createTestingModule({
      imports: [OperationsLabModule],
    }).compile();
    const app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.enableVersioning({
      type: VersioningType.CUSTOM,
      extractor: (incoming: unknown) => {
        const header = (incoming as { headers: Record<string, unknown> })
          .headers['x-api-versions'];
        return typeof header === 'string'
          ? header
              .split(',')
              .map((value) => value.trim())
              .filter((value) => /^[1-9]\d{0,2}$/.test(value))
              .sort((a, b) => Number(b) - Number(a))
          : [];
      },
    });
    await app.init();
    try {
      const result = await app.inject({
        method: 'GET',
        url: '/operations/summary',
        headers: { 'x-api-versions': '1, 3, 2' },
      });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual({ inventory: { used: 0, capacity: 100 } });
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/operations/summary',
            headers: { 'x-api-versions': '8,9' },
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
});
