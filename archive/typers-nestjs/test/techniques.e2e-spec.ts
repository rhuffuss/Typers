import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/platform/configure-app.js';
import { ActivityLog } from '../src/techniques/activity.js';

describe('Techniques and HTTP application', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    // ServeStatic chooses its loader while providers are created; use the real
    // bootstrap so HttpAdapterHost is initialized before that factory runs.
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      rawBody: true,
      logger: false,
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
  });
  const http = () => request(app.getHttpServer());

  it('validates built-in pipe inputs and rejects invalid UUIDs', async () => {
    const id = randomUUID();
    const { body } = await http()
      .get(
        `/api/v1/techniques/pipes/${id}?page=2&active=false&ids=3,4&mode=detailed`,
      )
      .expect(200);
    expect(body).toEqual({
      id,
      page: 2,
      active: false,
      ids: [3, 4],
      mode: 'detailed',
    });
    await http().get('/api/v1/techniques/pipes/invalid').expect(400);
  });

  it('validates and serializes Standard Schema without internal fields', async () => {
    await http()
      .post('/api/v1/techniques/schema')
      .send({ message: 'hello' })
      .expect(201, { message: 'hello' });
    await http()
      .post('/api/v1/techniques/schema')
      .send({ message: '' })
      .expect(400);
  });

  it('caches responses and clears them explicitly', async () => {
    const first = await http().get('/api/v1/techniques/cache').expect(200);
    expect(
      (await http().get('/api/v1/techniques/cache').expect(200)).body,
    ).toEqual(first.body);
    await http().post('/api/v1/techniques/cache/reset').expect(201);
    expect(
      (await http().get('/api/v1/techniques/cache').expect(200)).body
        .computation,
    ).toBe(first.body.computation + 1);
  });

  it('executes CQRS commands, queries, events and a saga', async () => {
    await http()
      .post('/api/v1/techniques/activity')
      .send({ message: 'command' })
      .expect(201);
    await http()
      .post('/api/v1/techniques/saga')
      .send({ message: 'saga' })
      .expect(201);
    await vi.waitFor(() =>
      expect(app.get(ActivityLog).messages).toContain('saga'),
    );
    expect((await http().get('/api/v1/techniques/activity')).body).toEqual(
      expect.arrayContaining(['command', 'saga']),
    );
  });

  it('preserves async-local context across concurrent requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        http().get('/api/v1/techniques/context').expect(200),
      ),
    );
    expect(
      new Set(responses.map((response) => response.body.requestId)).size,
    ).toBe(4);
    for (const response of responses)
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('uploads bytes, validates a missing file and streams a download', async () => {
    const bytes = Buffer.from('Typers');
    const uploaded = await http()
      .post('/api/v1/techniques/upload')
      .attach('file', bytes, 'demo.txt')
      .expect(201);
    expect(uploaded.body.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    await http().post('/api/v1/techniques/upload').expect(400);
    const csv = await http().get('/api/v1/techniques/download').expect(200);
    expect(csv.text).toContain('Typers NestJS');
    expect(csv.headers['content-disposition']).toContain('projects.csv');
  });

  it('emits a finite SSE sequence', async () => {
    const response = await http().get('/api/v1/techniques/events').expect(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text.match(/event: tick/g)).toHaveLength(3);
    expect(response.text).toContain('"index":2');
  });

  it('persists cookies and session state and enforces CSRF', async () => {
    const browser = request.agent(app.getHttpServer());
    await browser
      .get('/api/v1/techniques/cookies')
      .expect(200, { previous: null });
    await browser
      .get('/api/v1/techniques/cookies')
      .expect(200, { previous: 'dark' });
    await browser.get('/api/v1/techniques/session').expect(200, { visits: 1 });
    await browser.get('/api/v1/techniques/session').expect(200, { visits: 2 });
    const token = (await browser.get('/api/v1/techniques/csrf').expect(200))
      .body.token;
    await browser.post('/api/v1/techniques/csrf').expect(403);
    await browser
      .post('/api/v1/techniques/csrf')
      .set('x-csrf-token', token)
      .expect(200, { accepted: true });
  });

  it('retains raw body bytes and supports URI versioning', async () => {
    const raw = '{"x": 1}';
    await http()
      .post('/api/v1/techniques/raw-body')
      .set('content-type', 'application/json')
      .send(raw)
      .expect(201, {
        bytes: Buffer.byteLength(raw),
        sha256: createHash('sha256').update(raw).digest('hex'),
      });
    await http().get('/api/v1/techniques/version').expect(200, { version: 1 });
    await http().get('/api/v2/techniques/version').expect(200, { version: 2 });
  });

  it('serves MVC, static content, OpenAPI and health with security headers', async () => {
    expect(
      (await http().get('/api/v1/techniques/view').expect(200)).text,
    ).toContain('MVC renderizado');
    expect((await http().get('/static/demo.txt').expect(200)).text).toContain(
      'Static asset',
    );
    const health = await http().get('/api/v1/health').expect(200);
    expect(health.body.status).toBe('ok');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    const document = await http().get('/openapi.json').expect(200);
    expect(document.body.paths['/api/v1/techniques/upload']).toBeDefined();
  });

  it('returns 429 after the configured number of requests', async () => {
    await http().get('/api/v1/rate-limit').expect(200);
    await http().get('/api/v1/rate-limit').expect(200);
    await http().get('/api/v1/rate-limit').expect(429);
  });

  it('maps known errors and hides unexpected exception details', async () => {
    await http().get('/api/v1/techniques/errors/missing').expect(404);
    await http()
      .get('/api/v1/techniques/errors/unexpected')
      .expect(500, { statusCode: 500, message: 'Internal server error' });
  });

  it('uses HttpService against a real local upstream', async () => {
    const upstream = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end('{"upstream":true}');
    });
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    const address = upstream.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing upstream port');
    app
      .get(ConfigService)
      .set('DEMO_UPSTREAM_URL', `http://127.0.0.1:${address.port}`);
    try {
      await http()
        .get('/api/v1/techniques/http')
        .expect(200, { status: 200, data: { upstream: true } });
    } finally {
      app.get(ConfigService).set('DEMO_UPSTREAM_URL', undefined);
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
