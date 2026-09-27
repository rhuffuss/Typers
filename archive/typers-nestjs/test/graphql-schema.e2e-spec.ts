import 'reflect-metadata';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createSchemaFirstApplication,
  editorialTypeDefs,
} from '../src/graphql-lab/schema-first.js';
import { createFederationLab } from '../src/graphql-lab/federation.js';
import {
  generateEditorialDefinitions,
  generateEditorialSchema,
} from '../src/graphql-lab/generate-schema.js';

const execute = promisify(execFile);

describe('GraphQL alternate schemas and compilation', () => {
  it('executes SDL-first resolvers with Mercurius on Fastify', async () => {
    const app = await createSchemaFirstApplication();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: '{ schemaAuthor(id:"a1") { name articles { title } } }',
        },
      });
      expect(response.json()).toEqual({
        data: {
          schemaAuthor: {
            name: 'Ada',
            articles: [{ title: 'SCHEMA DRIVEN API' }],
          },
        },
      });
      const mutation = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query:
            'mutation { createSchemaArticle(input:{title:"Schema mutation",authorId:"a1"}) { id title } }',
        },
      });
      expect(mutation.json()).toEqual({
        data: { createSchemaArticle: { id: 's2', title: 'SCHEMA MUTATION' } },
      });
      const missing = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ schemaAuthor(id:"missing") { id } }' },
      });
      expect(missing.json().data.schemaAuthor).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('generates SDL using an application context without listening on HTTP', async () => {
    const sdl = await generateEditorialSchema();
    expect(sdl).toContain('type Author implements EditorialNode');
    expect(sdl).toContain('scalar Slug');
    expect(sdl).toContain('articleAdded(authorId: String): Article!');
    expect(sdl).toContain('input UpdateArticleInput');
  });

  it('generates TypeScript interfaces from SDL through GraphQLDefinitionsFactory', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'typers-graphql-definitions-'),
    );
    try {
      const input = join(directory, 'editorial.graphql');
      const output = join(directory, 'editorial.generated.ts');
      await writeFile(input, editorialTypeDefs);
      await generateEditorialDefinitions(input, output);
      const source = await readFile(output, 'utf8');
      expect(source).toContain('export interface SchemaAuthor');
      expect(source).toContain('export interface SchemaArticleInput');
      expect(source).toContain('__typename');
      expect(source).toContain('schemaAuthor');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('joins two real subgraphs through the Nest Apollo gateway', async () => {
    const lab = await createFederationLab();
    try {
      const response = await fetch(lab.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query:
            '{ federatedAuthors { id name articles { id title author { name } } } federatedArticle(id:"f1") { title author { name } } }',
        }),
      });
      const body = (await response.json()) as {
        data?: unknown;
        errors?: unknown;
      };
      expect(body.errors).toBeUndefined();
      expect(body.data).toEqual({
        federatedAuthors: [
          {
            id: 'a1',
            name: 'Ada Lovelace',
            articles: [
              {
                id: 'f1',
                title: 'Federated Nest',
                author: { name: 'Ada Lovelace' },
              },
            ],
          },
        ],
        federatedArticle: {
          title: 'Federated Nest',
          author: { name: 'Ada Lovelace' },
        },
      });
    } finally {
      await lab.close();
    }
  }, 30000);

  it('runs the real Nest CLI GraphQL plugin and inspects emitted metadata and SDL', async () => {
    await execute(
      process.execPath,
      [
        'node_modules/@nestjs/cli/bin/nest.js',
        'build',
        '--config',
        'nest-cli.graphql.json',
      ],
      { cwd: process.cwd(), timeout: 60000 },
    );
    const generated = await readFile(
      'dist-graphql-plugin/plugin-author.model.js',
      'utf8',
    );
    expect(generated).toContain('_GRAPHQL_METADATA_FACTORY');
    expect(generated).toContain('displayName');
    const { stdout } = await execute(
      process.execPath,
      ['dist-graphql-plugin/main.js'],
      { cwd: process.cwd(), timeout: 15000 },
    );
    expect(stdout).toContain('displayName: String!');
    expect(stdout).toContain('biography: String');
    expect(stdout).toContain('tags: [String!]!');
    expect(stdout).toContain(
      'Display name inferred by the GraphQL CLI plugin.',
    );
    expect(stdout).not.toContain('internalKey');
  }, 70000);
});
