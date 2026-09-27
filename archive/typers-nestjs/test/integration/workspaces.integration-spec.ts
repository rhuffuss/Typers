import {
  ClassSerializerInterceptor,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SecurityModule } from '../../src/security/security.module.js';
import { WorkspacesPersistenceModule } from '../../src/workspaces/persistence/workspaces-persistence.module.js';
import { TaskRecordEntity } from '../../src/workspaces/persistence/workspaces.entity.js';
import { WorkspacesController } from '../../src/workspaces/workspaces.controller.js';
import {
  ProjectStatus,
  TaskDto,
  TaskStatus,
} from '../../src/workspaces/workspaces.dto.js';
import {
  WORKSPACES_REPOSITORY,
  type WorkspacesRepository,
} from '../../src/workspaces/workspaces.repository.js';
import { WorkspacesService } from '../../src/workspaces/workspaces.service.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PostgreSQL / TypeORM workspaces integration', () => {
  const schema = `typers_test_${randomUUID().replaceAll('-', '')}`;
  const ownerId = '00000000-0000-4000-8000-000000000001';
  let admin: DataSource;
  let dataSource: DataSource;
  let app: INestApplication<App>;
  let service: WorkspacesService;
  let repository: WorkspacesRepository;
  let token: string;

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const module = await Test.createTestingModule({
      imports: [
        SecurityModule,
        WorkspacesPersistenceModule.register({
          driver: 'postgres',
          url,
          schema,
        }),
      ],
      controllers: [WorkspacesController],
      providers: [WorkspacesService],
    }).compile();
    app = module.createNestApplication();
    dataSource = app.get(DataSource);
    expect(await dataSource.runMigrations()).toHaveLength(1);
    expect(await dataSource.runMigrations()).toHaveLength(0);
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
    service = app.get(WorkspacesService);
    repository = app.get<WorkspacesRepository>(WORKSPACES_REPOSITORY);
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.DEMO_ADMIN_EMAIL ?? 'admin@typers.local',
        password: process.env.DEMO_ADMIN_PASSWORD ?? 'TypersDemo-Admin-2026!',
      })
      .expect(200);
    token = (response.body as { access_token: string }).access_token;
  }, 30000);

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      if (admin?.isInitialized) {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.destroy();
      }
    }
  });

  it('persists nested project/task HTTP contracts in PostgreSQL', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .auth(token, { type: 'bearer' })
      .send({
        name: 'PostgreSQL HTTP contract',
        slug: `http-${randomUUID()}`,
        labels: ['database'],
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const task = await request(app.getHttpServer())
      .post(`/projects/${id}/tasks`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Verify a relation', status: 'in_progress' })
      .expect(201);
    const taskId = (task.body as { id: string }).id;
    const loaded = await request(app.getHttpServer())
      .get(`/projects/${id}`)
      .expect(200);
    expect(loaded.body).toMatchObject({
      labels: ['database'],
      tasks: [{ id: taskId, status: 'in_progress' }],
    });
    expect((await repository.findById(id))?.createdAt).toBeInstanceOf(Date);
    await request(app.getHttpServer())
      .patch(`/projects/${id}`)
      .auth(token, { type: 'bearer' })
      .send({ status: ProjectStatus.Archived })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/projects/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    expect(
      await dataSource
        .getRepository(TaskRecordEntity)
        .countBy({ projectId: id }),
    ).toBe(0);
    await request(app.getHttpServer()).get(`/projects/${id}`).expect(404);
  });

  it('translates the database unique constraint into a 409 conflict', async () => {
    const slug = `unique-${randomUUID()}`;
    await service.createProject({ name: 'First project', slug }, ownerId);
    await expect(
      service.createProject({ name: 'Duplicate slug', slug }, ownerId),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rolls back parent and child changes when one task violates a database constraint', async () => {
    const project = await service.createProject(
      { name: 'Before transaction', slug: `rollback-${randomUUID()}` },
      ownerId,
    );
    const task = await service.createTask(project.id, {
      title: 'Keep this original task',
      status: TaskStatus.Todo,
    });
    const aggregate = await service.getProject(project.id);
    aggregate.name = 'Must roll back';
    aggregate.tasks = [
      Object.assign(new TaskDto(), task, { title: 'x'.repeat(201) }),
    ];
    await expect(repository.save(aggregate)).rejects.toThrow();
    const unchanged = await service.getProject(project.id);
    expect(unchanged.name).toBe('Before transaction');
    expect(unchanged.tasks).toHaveLength(1);
    expect(unchanged.tasks[0]).toMatchObject({
      id: task.id,
      title: 'Keep this original task',
    });
  });

  it('supports explicit QueryRunner rollback without leaking a temporary write', async () => {
    const project = await service.createProject(
      { name: 'Transaction isolation', slug: `isolation-${randomUUID()}` },
      ownerId,
    );
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `UPDATE "${schema}"."projects" SET "name" = $1 WHERE "id" = $2`,
        ['Temporary change', project.id],
      );
      await runner.rollbackTransaction();
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
    expect((await service.getProject(project.id)).name).toBe(
      'Transaction isolation',
    );
  });

  it('reverts and reapplies its explicit migration inside the disposable schema', async () => {
    await dataSource.undoLastMigration();
    const tables = await dataSource.query<{ tablename: string }[]>(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename IN ($2, $3)',
      [schema, 'projects', 'tasks'],
    );
    expect(tables).toEqual([]);
    expect(await dataSource.runMigrations()).toHaveLength(1);
    expect(await repository.findAll()).toEqual([]);
  });
});
