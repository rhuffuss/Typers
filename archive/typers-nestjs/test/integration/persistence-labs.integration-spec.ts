import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLabNamespace } from '../../src/persistence-labs/lab-options.js';
import {
  MongooseLabModule,
  MongooseLabService,
} from '../../src/persistence-labs/mongoose-lab.js';
import {
  SequelizeLabModule,
  SequelizeLabService,
} from '../../src/persistence-labs/sequelize-lab.js';
import {
  MikroLabModule,
  MikroLabService,
} from '../../src/persistence-labs/mikro-lab.js';
import {
  PrismaLabModule,
  PrismaLabService,
} from '../../src/persistence-labs/prisma/prisma-lab.js';

const execute = promisify(execFile);
const databaseUrl = process.env.TEST_DATABASE_URL;
const mongoUrl = process.env.TEST_MONGO_URL;

function namespace(lab: string) {
  return assertLabNamespace(
    `typers_lab_${lab}_${randomUUID().replaceAll('-', '')}`,
  );
}

async function withSqlSchema(
  lab: string,
  run: (schema: string) => Promise<void>,
) {
  const schema = namespace(lab);
  const admin = new Pool({ connectionString: databaseUrl });
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await run(schema);
  } finally {
    try {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
}

// The connection closes during app.close(); references are retained only for cleanup assertions.
const closedMongoConnections: MongooseLabService['connection'][] = [];
afterAll(() => {
  for (const connection of closedMongoConnections)
    expect(connection.readyState).toBe(0);
});

describe.skipIf(!mongoUrl)('Mongoose / real MongoDB alternative', () => {
  it('persists nested schemas, hooks and discriminators and rejects a duplicate index', async () => {
    const database = namespace('mongoose');
    let app: INestApplicationContext | undefined;
    let service: MongooseLabService | undefined;
    try {
      app = await NestFactory.createApplicationContext(
        MongooseLabModule.register({ url: mongoUrl!, database }),
        { logger: false, abortOnError: false },
      );
      service = app.get<MongooseLabService>(MongooseLabService);
      await service.notes.init();
      const note = await service.create(
        'first-note',
        '  Mongoose decorators  ',
      );
      expect(note.prepared).toBe(true);
      expect(note.title).toBe('Mongoose decorators');
      expect(note.createdAt).toBeInstanceOf(Date);
      expect(await service.find('first-note')).toMatchObject({
        title: 'Mongoose decorators',
        tags: ['nestjs'],
        metadata: { category: 'compiler' },
      });
      await expect(
        service.create('first-note', 'Duplicate'),
      ).rejects.toMatchObject({ code: 11000 });
      await expect(service.create('invalid-note', 'x')).rejects.toThrow();
      const published = await service.published.create({
        slug: 'published-note',
        title: 'Published discriminator',
        metadata: { category: 'compiler' },
        publication: 'Typers journal',
      });
      expect(
        await service.published.findById(published._id).lean().exec(),
      ).toMatchObject({
        kind: 'MongoLabPublishedNote',
        publication: 'Typers journal',
        prepared: true,
      });
      await service.notes
        .updateOne({ slug: 'first-note' }, { $push: { tags: 'validated' } })
        .exec();
      expect((await service.find('first-note'))?.tags).toEqual([
        'nestjs',
        'validated',
      ]);
      await service.notes.deleteOne({ slug: 'first-note' }).exec();
      expect(await service.find('first-note')).toBeNull();
    } finally {
      try {
        if (service) {
          assertLabNamespace(service.connection.name);
          await service.connection.dropDatabase();
          closedMongoConnections.push(service.connection);
        }
      } finally {
        await app?.close();
      }
    }
  }, 30000);
});

describe.skipIf(!databaseUrl)('PostgreSQL persistence alternatives', () => {
  it('uses Sequelize named providers, associations and managed transaction rollback', async () => {
    await withSqlSchema('sequelize', async (schema) => {
      const app = await NestFactory.createApplicationContext(
        SequelizeLabModule.register({ url: databaseUrl!, schema }),
        { logger: false, abortOnError: false },
      );
      try {
        const service = app.get(SequelizeLabService);
        const id = await service.create('Sequelize writer', 'Associated note');
        const loaded = await service.find(id);
        expect(loaded?.name).toBe('Sequelize writer');
        expect(loaded?.notes[0]?.title).toBe('Associated note');
        await expect(service.rollbackProbe()).rejects.toThrow(
          'sequelize-rollback-probe',
        );
        expect(await service.writers.count()).toBe(1);
        expect(await service.notes.count()).toBe(1);
        await service.notes.update(
          { title: 'Updated through Sequelize' },
          { where: { writerId: id } },
        );
        expect((await service.find(id))?.notes[0]?.title).toBe(
          'Updated through Sequelize',
        );
      } finally {
        await app.close();
      }
    });
  }, 30000);

  it('uses MikroORM decorators, request context, repository, relations, serialization and rollback', async () => {
    await withSqlSchema('mikro', async (schema) => {
      const app = await NestFactory.createApplicationContext(
        MikroLabModule.register({ url: databaseUrl!, schema }),
        { logger: false, abortOnError: false },
      );
      try {
        const service = app.get(MikroLabService);
        await service.orm.schema.create();
        const id = await service.create('Mikro writer', 'Unit of work note');
        const loaded = await service.find(id);
        expect(loaded).toMatchObject({
          name: 'Mikro writer',
          notes: [{ title: 'Unit of work note' }],
        });
        expect(loaded).not.toHaveProperty('secret');
        await expect(service.rollbackProbe()).rejects.toThrow(
          'mikro-rollback-probe',
        );
        expect(await service.count()).toBe(1);
        const concurrent = await Promise.all([
          service.find(id),
          service.find(id),
        ]);
        expect(concurrent[0]).toEqual(concurrent[1]);
        const contextIds = await Promise.all([
          service.contextId(),
          service.contextId(),
        ]);
        expect(new Set(contextIds).size).toBe(2);
      } finally {
        await app.close();
      }
    });
  }, 30000);

  it('deploys a Prisma migration, uses its generated ESM client and closes lifecycle connections', async () => {
    await withSqlSchema('prisma', async (schema) => {
      const migrationUrl = new URL(databaseUrl!);
      migrationUrl.searchParams.set('schema', schema);
      const { stdout } = await execute(
        process.execPath,
        [
          'node_modules/prisma/build/index.js',
          'migrate',
          'deploy',
          '--config',
          'src/persistence-labs/prisma/prisma.config.ts',
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, PRISMA_DATABASE_URL: migrationUrl.href },
          timeout: 30000,
        },
      );
      expect(stdout).toContain('202609150001_init');
      const app = await NestFactory.createApplicationContext(
        PrismaLabModule.register({ url: databaseUrl!, schema }),
        { logger: false, abortOnError: false },
      );
      const service = app.get(PrismaLabService);
      try {
        expect(service.connected).toBe(true);
        const writer = await service.create(
          'Prisma writer',
          'Generated client note',
        );
        expect(await service.find(writer.id)).toMatchObject({
          name: 'Prisma writer',
          notes: [{ title: 'Generated client note' }],
        });
        await expect(service.rollbackProbe()).rejects.toThrow(
          'prisma-rollback-probe',
        );
        expect(await service.prismaLabWriter.count()).toBe(1);
        expect(await service.prismaLabNote.count()).toBe(1);
        await service.prismaLabWriter.delete({ where: { id: writer.id } });
        expect(await service.prismaLabNote.count()).toBe(0);
      } finally {
        await app.close();
      }
      expect(service.connected).toBe(false);
    });
  }, 45000);
});
