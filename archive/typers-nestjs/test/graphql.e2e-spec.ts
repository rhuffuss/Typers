import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Author } from '../src/graphql-lab/graphql.models.js';
import request from 'supertest';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import { GraphqlLabModule } from '../src/graphql-lab/graphql-lab.module.js';
import { EditorialService } from '../src/graphql-lab/editorial.service.js';
import { EditorialPlugin } from '../src/graphql-lab/editorial.plugin.js';
import { GraphqlTrace } from '../src/graphql-lab/graphql.support.js';

interface GraphqlResult {
  data?: Record<string, unknown>;
  errors?: { message: string; extensions: Record<string, unknown> }[];
}

describe('GraphQL Apollo code first laboratory', () => {
  let app: INestApplication;
  let address: string;
  const query = (
    source: string,
    variables: Record<string, unknown> = {},
    editor = false,
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('x-editorial-role', editor ? 'editor' : 'reader')
      .send({ query: source, variables });
  beforeAll(async () => {
    app = await NestFactory.create(GraphqlLabModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    address = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('resolves queries, fields, scalar output, enums and the upper directive', async () => {
    const response = await query(
      '{ authors { id name articles { title slug state createdAt author { id } } } editorialContext }',
    );
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.authors[0]).toEqual({
      id: 'a1',
      name: 'Ada',
      articles: [
        {
          title: 'NEST ARCHITECTURE',
          slug: 'nest-architecture',
          state: 'PUBLISHED',
          createdAt: '2026-01-01T00:00:00.000Z',
          author: { id: 'a1' },
        },
      ],
    });
    expect(response.body.data.editorialContext).toBe('editorialContext:reader');
    expect(app.get(GraphqlTrace).calls).toContain('after:authors');
    expect(app.get(GraphqlTrace).calls).toContain('after:articles');
    expect(app.get(GraphqlTrace).calls).toContain('after:author');
  });

  it('inherits a generic object type and injects a custom GraphQL parameter decorator', async () => {
    const response = await query(
      '{ authorsPage { total items { name } } editorialRole }',
      {},
      true,
    );
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({
      authorsPage: { total: 2, items: [{ name: 'Ada' }, { name: 'Grace' }] },
      editorialRole: 'editor',
    });
  });

  it('resolves interface and union concrete types', async () => {
    const response = await query(
      '{ editorialNode(id:"p1") { id __typename ... on Article { title } } editorialSearch { __typename ... on Author { name } ... on Article { title } } }',
    );
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.editorialNode).toEqual({
      id: 'p1',
      __typename: 'Article',
      title: 'NEST ARCHITECTURE',
    });
    expect(
      response.body.data.editorialSearch.map(
        (item: { __typename: string }) => item.__typename,
      ),
    ).toEqual(['Author', 'Author', 'Article']);
  });

  it('checks field extensions through middleware', async () => {
    const rejected = await query('{ author(id:"a1") { name editorialNote } }');
    expect(rejected.body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(rejected.body.data.author.editorialNote).toBeNull();
    const allowed = await query(
      '{ author(id:"a1") { editorialNote } }',
      {},
      true,
    );
    expect(allowed.body.data.author.editorialNote).toBe('Draft reviewer');
  });

  it('executes guarded mutations with DTO validation and mapped input types', async () => {
    const mutation =
      'mutation($input: CreateArticleInput!) { createArticle(input:$input) { id title state } }';
    const input = { title: 'Validated article', authorId: 'a1' };
    expect(
      (await query(mutation, { input })).body.errors[0].extensions.code,
    ).toBe('FORBIDDEN');
    const invalid = await query(
      mutation,
      { input: { ...input, title: 'x' } },
      true,
    );
    expect(invalid.body.errors[0].message).toContain('Bad Request');
    const created = await query(mutation, { input }, true);
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createArticle.title).toBe('VALIDATED ARTICLE');
    const updated = await query(
      'mutation($input: UpdateArticleInput!) { updateArticle(input:$input) { title state } }',
      { input: { id: created.body.data.createArticle.id, state: 'PUBLISHED' } },
      true,
    );
    expect(updated.body.data.updateArticle).toEqual({
      title: 'VALIDATED ARTICLE',
      state: 'PUBLISHED',
    });
    const titleOnly = await query(
      'mutation($input: UpdateArticleInput!) { updateArticle(input:$input) { title state } }',
      {
        input: {
          id: created.body.data.createArticle.id,
          title: 'Partial change',
        },
      },
      true,
    );
    expect(titleOnly.body.data.updateArticle).toEqual({
      title: 'PARTIAL CHANGE',
      state: 'PUBLISHED',
    });
    expect(
      (
        await query(
          'query($input: ArticleTitleInput!) { previewArticleTitle(input:$input) }',
          { input: { title: 'Picked title' } },
        )
      ).body.data.previewArticleTitle,
    ).toBe('Picked title');
    expect(
      (await query('{ articles(offset:-1, limit:1) { id } }')).body.errors,
    ).toBeDefined();
  });

  it('parses scalar variables and literals and rejects invalid values', async () => {
    expect(
      (await query('{ echoSlug(value:"valid-slug") }')).body.data.echoSlug,
    ).toBe('valid-slug');
    expect(
      (
        await query('query($value:Slug!) { echoSlug(value:$value) }', {
          value: 'another-slug',
        })
      ).body.data.echoSlug,
    ).toBe('another-slug');
    expect(
      (await query('{ echoSlug(value:"INVALID") }')).body.errors[0].message,
    ).toContain('Slug');
    expect(
      (
        await query('query($value:Slug!) { echoSlug(value:$value) }', {
          value: 13,
        })
      ).body.errors,
    ).toBeDefined();
  });

  it('applies exception filters and the plugin complexity budget', async () => {
    expect(
      (await query('{ author(id:"missing") { id } }')).body.errors[0]
        .extensions,
    ).toMatchObject({ code: 'EDITORIAL_NOT_FOUND', field: 'author' });
    const tooComplex = await query(
      '{ articles(limit:50) { id title author { id name } } }',
    );
    expect(tooComplex.body.errors[0].extensions.code).toBe('QUERY_TOO_COMPLEX');
    expect(
      app
        .get(EditorialPlugin)
        .operations.some((operation) => operation.complexity > 100),
    ).toBe(true);
    expect(app.get(EditorialPlugin).completedRequests).toBeGreaterThan(0);
  });

  it('generates mapped types and shares a model with OpenAPI', () => {
    const sdl = printSchema(app.get(GraphQLSchemaHost).schema);
    expect(sdl).toContain('union EditorialSearchResult = Article | Author');
    expect(sdl).toContain('interface EditorialNode');
    expect(sdl).toMatch(/input UpdateArticleInput[\s\S]*?title: String\n/);
    expect(sdl).toContain('scalar Slug');
    const openapi = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
      { extraModels: [Author] },
    );
    expect(openapi.components?.schemas?.Author).toMatchObject({
      properties: { id: { type: 'string' }, name: { type: 'string' } },
    });
  });

  it('delivers a filtered graphql-ws subscription and releases its listener', async () => {
    const service = app.get(EditorialService);
    const client = createClient({
      url: address.replace('http:', 'ws:') + '/graphql',
      webSocketImpl: WebSocket,
      retryAttempts: 0,
    });
    let unsubscribe = () => {};
    const messages: GraphqlResult[] = [];
    let resolveResult!: (value: GraphqlResult) => void;
    let rejectResult!: (reason: unknown) => void;
    const received = new Promise<GraphqlResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    try {
      unsubscribe = client.subscribe<GraphqlResult>(
        {
          query:
            'subscription { articleAdded(authorId:"a1") { title authorId } }',
        },
        {
          next: (result) => {
            messages.push(result as GraphqlResult);
            resolveResult(result as GraphqlResult);
          },
          error: rejectResult,
          complete: () => {},
        },
      );
      await vi.waitFor(() => expect(service.subscriptionListeners).toBe(1));
      const mutation =
        'mutation($input:CreateArticleInput!) { createArticle(input:$input) { id } }';
      await query(
        mutation,
        { input: { title: 'Excluded event', authorId: 'a2' } },
        true,
      );
      await query(
        mutation,
        { input: { title: 'Included event', authorId: 'a1' } },
        true,
      );
      const result = await received;
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        articleAdded: { title: 'INCLUDED EVENT', authorId: 'a1' },
      });
      expect(messages).toHaveLength(1);
    } finally {
      unsubscribe();
      await client.dispose();
      await vi.waitFor(() => expect(service.subscriptionListeners).toBe(0));
    }
  });
});
