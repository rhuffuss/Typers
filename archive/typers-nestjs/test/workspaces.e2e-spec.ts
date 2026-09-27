import {
  ClassSerializerInterceptor,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DemoUsersService } from '../src/security/demo-users.service.js';
import { WorkspacesModule } from '../src/workspaces/workspaces.module.js';
import {
  InMemoryWorkspacesRepository,
  WORKSPACES_REPOSITORY,
} from '../src/workspaces/workspaces.repository.js';

describe('Workspaces and security HTTP contracts', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let readerToken: string;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [WorkspacesModule],
    })
      .overrideProvider(WORKSPACES_REPOSITORY)
      .useValue(new InMemoryWorkspacesRepository())
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.DEMO_ADMIN_EMAIL ?? 'admin@typers.local',
        password: process.env.DEMO_ADMIN_PASSWORD ?? 'TypersDemo-Admin-2026!',
      })
      .expect(200);
    const reader = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.DEMO_READER_EMAIL ?? 'reader@typers.local',
        password: process.env.DEMO_READER_PASSWORD ?? 'TypersDemo-Reader-2026!',
      })
      .expect(200);
    adminToken = (admin.body as { access_token: string }).access_token;
    readerToken = (reader.body as { access_token: string }).access_token;
    expect(admin.body).toMatchObject({ token_type: 'Bearer', expires_in: 900 });
    expect(JSON.stringify(admin.body)).not.toMatch(/password|scrypt/);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('hashes seeded credentials and serializes profiles without password hashes', async () => {
    const user = app.get(DemoUsersService).findAll()[0];
    expect(user.passwordHash).toMatch(/^scrypt:/);
    const profile = await request(app.getHttpServer())
      .get('/auth/me')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(profile.body).toMatchObject({
      id: user.id,
      roles: ['admin', 'member'],
    });
    expect(profile.body).not.toHaveProperty('passwordHash');
    const list = await request(app.getHttpServer())
      .get('/auth/users')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/password|scrypt/);
  });

  it('rejects malformed login DTOs, incorrect credentials, missing tokens, and invalid tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'invalid', password: 'x' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@typers.local', password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth('invalid-token', { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/projects')
      .send({ name: 'Protected project', slug: 'protected' })
      .expect(401);
  });

  it('enforces role metadata after Passport authentication', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(readerToken, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/users')
      .auth(readerToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/projects')
      .auth(readerToken, { type: 'bearer' })
      .send({ name: 'Forbidden project', slug: 'forbidden' })
      .expect(403);
  });

  it('transforms pagination, rejects unknown fields and invalid UUIDs, and reports absent projects', async () => {
    const page = await request(app.getHttpServer())
      .get('/projects?page=1&limit=1&status=active&search=typers')
      .expect(200);
    expect(page.body).toMatchObject({ page: 1, limit: 1, total: 1, pages: 1 });
    await request(app.getHttpServer()).get('/projects?page=0').expect(400);
    await request(app.getHttpServer()).get('/projects?limit=101').expect(400);
    await request(app.getHttpServer()).get('/projects?extra=1').expect(400);
    await request(app.getHttpServer()).get('/projects/not-a-uuid').expect(400);
    await request(app.getHttpServer())
      .get('/projects/00000000-0000-4000-8000-000000000099')
      .expect(404);
    await request(app.getHttpServer())
      .post('/projects')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Invalid', slug: 'Invalid Slug', ownerId: 'injected' })
      .expect(400);
  });

  it('runs project and nested task CRUD with conflicts, partial updates, and deletion semantics', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: '  Contract demo  ',
        slug: 'contract-demo',
        labels: ['tests'],
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    expect(created.body).toMatchObject({
      name: 'Contract demo',
      description: '',
      status: 'active',
      tasks: [],
      ownerId: '00000000-0000-4000-8000-000000000001',
    });
    expect((created.body as { createdAt: string }).createdAt).toMatch(
      /^\d{4}-/,
    );
    await request(app.getHttpServer())
      .post('/projects')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Duplicate', slug: 'contract-demo' })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/projects/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ name: null })
      .expect(400);
    const updated = await request(app.getHttpServer())
      .patch(`/projects/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'archived' })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Contract demo',
      status: 'archived',
    });
    const task = await request(app.getHttpServer())
      .post(`/projects/${id}/tasks`)
      .auth(adminToken, { type: 'bearer' })
      .send({ title: 'Check emitted decorator metadata' })
      .expect(201);
    const taskId = (task.body as { id: string }).id;
    expect(task.body).toMatchObject({ projectId: id, status: 'todo' });
    await request(app.getHttpServer())
      .get(`/projects/${id}/tasks/${taskId}`)
      .expect(200);
    const tasks = await request(app.getHttpServer())
      .get(`/projects/${id}/tasks`)
      .expect(200);
    expect(tasks.body).toHaveLength(1);
    const completed = await request(app.getHttpServer())
      .patch(`/projects/${id}/tasks/${taskId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'done' })
      .expect(200);
    expect(completed.body).toMatchObject({
      status: 'done',
      title: 'Check emitted decorator metadata',
    });
    await request(app.getHttpServer())
      .patch(`/projects/${id}/tasks/${taskId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'unknown' })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/projects/${id}/tasks/${taskId}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(204)
      .expect('');
    await request(app.getHttpServer())
      .get(`/projects/${id}/tasks/${taskId}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/projects/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(204)
      .expect('');
    await request(app.getHttpServer()).get(`/projects/${id}`).expect(404);
  });
});
