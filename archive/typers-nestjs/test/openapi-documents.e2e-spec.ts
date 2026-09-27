import type {
  OpenAPIObject,
  OperationObject,
  ResponseObject,
} from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMultipleDocumentsLab } from '../src/openapi-lab/multiple-documents.js';

describe('Selective OpenAPI documents over real Nest HTTP', () => {
  let lab: Awaited<ReturnType<typeof createMultipleDocumentsLab>>;
  let origin: string;
  let catalog: OpenAPIObject;
  let members: OpenAPIObject;

  beforeAll(async () => {
    lab = await createMultipleDocumentsLab();
    await lab.app.listen(0, '127.0.0.1');
    origin = await lab.app.getUrl();
    const catalogResponse = await fetch(`${origin}/specs/catalog.json`);
    const membersResponse = await fetch(`${origin}/specs/members.json`);
    expect(catalogResponse.status).toBe(200);
    expect(membersResponse.status).toBe(200);
    catalog = (await catalogResponse.json()) as OpenAPIObject;
    members = (await membersResponse.json()) as OpenAPIObject;
  });

  afterAll(async () => {
    await lab?.app.close();
  });

  it('includes only each selected module and its own schemas', () => {
    expect(Object.keys(catalog.paths).sort()).toEqual([
      '/api/catalog',
      '/api/catalog/featured',
      '/api/catalog/{id}',
      '/api/revisions',
    ]);
    expect(Object.keys(members.paths)).toEqual(['/api/members']);
    expect(Object.keys(catalog.components?.schemas ?? {}).sort()).toEqual([
      'PageDto',
      'PublicationDto',
    ]);
    expect(Object.keys(members.components?.schemas ?? {})).toEqual([
      'MemberDto',
    ]);
    expect(catalog.info.title).toBe('Publication catalog');
    expect(members.info.title).toBe('Members directory');
  });

  it('deepScanRoutes includes the imported revision module without including sibling members', async () => {
    expect(lab.shallowCatalog.paths['/api/revisions']).toBeUndefined();
    expect(lab.shallowCatalog.paths['/api/catalog']).toBeDefined();
    expect(catalog.paths['/api/revisions']).toBeDefined();
    expect(catalog.paths['/api/members']).toBeUndefined();
    const response = await fetch(`${origin}/api/revisions`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 1 });
  });

  it('combines a generic page and explicit item schema, matching the actual response', async () => {
    const response = catalog.paths['/api/catalog'].get!.responses[
      '200'
    ] as ResponseObject;
    expect(response.content?.['application/json'].schema).toEqual({
      allOf: [
        { $ref: '#/components/schemas/PageDto' },
        {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/PublicationDto' },
            },
          },
        },
      ],
    });
    const actual = await fetch(`${origin}/api/catalog`);
    expect(actual.status).toBe(200);
    expect(await actual.json()).toEqual({
      total: 1,
      items: [{ id: 'nest-reference', title: 'NestJS reference' }],
    });
  });

  it('resolves operationId and relative operationRef links and follows their response parameter', async () => {
    const operation = catalog.paths['/api/catalog/featured'].get!;
    const response = operation.responses['200'] as ResponseObject;
    const links = response.links!;
    expect(links.publicationById).toEqual({
      operationId: 'PublicationsController.findOne',
      parameters: { id: '$response.body#/id' },
    });
    const target = catalog.paths['/api/catalog/{id}'].get!;
    expect(target.operationId).toBe('PublicationsController.findOne');
    const relative = links.relativePublication;
    if ('$ref' in relative) throw new Error('Expected an inline OpenAPI link');
    const reference = new URL(
      relative.operationRef!,
      `${origin}/specs/catalog.json`,
    );
    expect(reference.origin).toBe(origin);
    expect(reference.pathname).toBe('/specs/catalog.json');
    const documentResponse = await fetch(reference);
    const document: unknown = await documentResponse.json();
    const pointer = decodeURIComponent(reference.hash.slice(2))
      .split('/')
      .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
    let resolved: unknown = document;
    for (const part of pointer)
      resolved = (resolved as Record<string, unknown>)[part];
    expect((resolved as OperationObject).operationId).toBe(target.operationId);
    const featured = (await fetch(`${origin}/api/catalog/featured`).then(
      (result) => result.json(),
    )) as { id: string };
    const followed = await fetch(
      `${origin}/api/catalog/${encodeURIComponent(featured.id)}`,
    );
    expect(followed.status).toBe(200);
    expect(await followed.json()).toEqual(featured);
    expect((await fetch(`${origin}/api/catalog/missing`)).status).toBe(404);
  });

  it('serves separate Swagger interfaces and a selector pointing at the served JSON documents', async () => {
    for (const name of ['catalog', 'members']) {
      const html = await fetch(`${origin}/docs/${name}/`);
      expect(html.status).toBe(200);
      expect(await html.text()).toContain('swagger-ui');
      const init = await fetch(
        `${origin}/docs/${name}/swagger-ui-init.js`,
      ).then((result) => result.text());
      expect(init).toContain(
        name === 'catalog' ? 'Publication catalog' : 'Members directory',
      );
      expect(init).not.toContain(
        name === 'catalog' ? 'MemberDto' : 'PublicationDto',
      );
      const bundle = await fetch(`${origin}/docs/${name}/swagger-ui-bundle.js`);
      expect(bundle.status).toBe(200);
      await bundle.body?.cancel();
    }
    const explorer = await fetch(`${origin}/docs/swagger-ui-init.js`).then(
      (result) => result.text(),
    );
    expect(explorer).toContain('"url": "/specs/catalog.json"');
    expect(explorer).toContain('"url": "/specs/members.json"');
    expect((await fetch(`${origin}/docs-json`)).status).toBe(404);
  });
});
