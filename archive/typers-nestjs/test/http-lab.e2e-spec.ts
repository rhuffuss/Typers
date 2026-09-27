import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  createHttpLab,
  ScheduleProbe,
  VersioningType,
} from '../src/http-lab/http-lab.js';

describe('HTTP lifecycle, recipes and FAQ contracts', () => {
  it('preserves request pipeline ordering, reverse interceptor return order and filter short circuit', async () => {
    const app = await createHttpLab();
    try {
      const response = await request(app.getHttpServer())
        .get('/lifecycle/hello')
        .expect(200);
      expect(response.body).toEqual({
        value: 'HELLO',
        trace: [
          'middleware',
          'global-guard',
          'local-guard',
          'global-interceptor:before',
          'local-interceptor:before',
          'global-pipe',
          'local-pipe',
          'handler',
          'local-interceptor:after',
          'global-interceptor:after',
        ],
      });
      const failed = await request(app.getHttpServer())
        .get('/lifecycle/error')
        .expect(500);
      expect(failed.body.trace).toEqual([
        'middleware',
        'global-guard',
        'local-guard',
        'global-interceptor:before',
        'local-interceptor:before',
        'handler',
        'filter',
      ]);
    } finally {
      await app.close();
    }
  });

  it('mounts RouterModule children, negotiates compression/CORS and actually fires cron/interval/timeout', async () => {
    const app = await createHttpLab();
    try {
      await request(app.getHttpServer())
        .get('/outer/inner/leaf')
        .expect(200, { nested: true });
      const compressed = await request(app.getHttpServer())
        .get('/large')
        .set('accept-encoding', 'gzip')
        .expect(200);
      expect(compressed.headers['content-encoding']).toBe('gzip');
      const cors = await request(app.getHttpServer())
        .options('/large')
        .set('origin', 'http://demo.local')
        .set('access-control-request-method', 'GET')
        .expect(204);
      expect(cors.headers['access-control-allow-origin']).toBe(
        'http://demo.local',
      );
      const probe = app.get(ScheduleProbe);
      await vi.waitFor(
        () => {
          expect(probe.crons).toBeGreaterThan(0);
          expect(probe.intervals).toBeGreaterThan(0);
          expect(probe.timeouts).toBe(1);
        },
        { timeout: 2500 },
      );
      await app.close();
      const snapshot = [probe.crons, probe.intervals, probe.timeouts];
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect([probe.crons, probe.intervals, probe.timeouts]).toEqual(snapshot);
    } finally {
      await app.close();
    }
  });

  it.each(['header', 'media', 'custom'] as const)(
    'selects the correct API with %s versioning',
    async (kind) => {
      const app = await createHttpLab(
        kind === 'header'
          ? { type: VersioningType.HEADER, header: 'x-version' }
          : kind === 'media'
            ? { type: VersioningType.MEDIA_TYPE, key: 'v=' }
            : {
                type: VersioningType.CUSTOM,
                extractor: (req: unknown) => {
                  const value = (req as { headers?: Record<string, unknown> })
                    .headers?.['x-custom-version'];
                  return typeof value === 'string' ? value : '';
                },
              },
      );
      try {
        const response = request(app.getHttpServer()).get('/version');
        if (kind === 'header') response.set('x-version', '2');
        else if (kind === 'media')
          response.set('accept', 'application/json;v=2');
        else response.set('x-custom-version', '2');
        await response.expect(200, { version: 2 });
        await request(app.getHttpServer()).get('/version').expect(404);
      } finally {
        await app.close();
      }
    },
  );

  it('reports a missing injection dependency as a real Nest diagnostic', async () => {
    class MissingDependency {}
    @Injectable()
    class BrokenProvider {
      constructor(readonly dependency: MissingDependency) {}
    }
    await expect(
      Test.createTestingModule({ providers: [BrokenProvider] }).compile(),
    ).rejects.toThrow(/can't resolve dependencies/i);
  });
});
