import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { None, Some } from '@typers/core';
import { createApplication } from '../dist/bootstrap.js';
import { CatalogRepository } from '../dist/catalog/catalog.repository.js';
import { QuotesService } from '../dist/quotes/quotes.service.js';
import { ReservationsService } from '../dist/reservations/reservations.service.js';

// Every HTTP assertion runs against the JavaScript emitted by native Typers.
// No test runner transforms or imports the experimental TypeScript source.
async function withApplication(run) {
  const app = await createApplication({ logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const request = async (path, body) => {
      const response = await fetch(`${base}${path}`, {
        ...(body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
        signal: AbortSignal.timeout(5000),
      });
      return { status: response.status, body: await response.json() };
    };
    await run({ app, base, request });
  } finally {
    await app.close();
  }
}

test('catalog: zero stock is a present product; an unknown SKU returns 404', async () => {
  await withApplication(async ({ request }) => {
    const catalog = await request('/api/products');
    assert.equal(catalog.status, 200);
    assert.ok(catalog.body.some((product) => product.sku === 'WIDGET'));
    const empty = await request('/api/products/EMPTY');
    assert.equal(empty.status, 200);
    assert.equal(empty.body.sku, 'EMPTY');
    assert.equal(empty.body.stock, 0);
    const missing = await request('/api/products/MISSING');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'PRODUCT_NOT_FOUND');
  });
});

test('quotes: BigInt money rounds the discount down and serializes exact cents', async () => {
  await withApplication(async ({ request }) => {
    const result = await request('/api/quotes', {
      sku: 'WIDGET',
      quantity: 3,
      coupon: 'SAVE10',
      note: 'Inspect this quote in Swagger',
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      sku: 'WIDGET',
      quantity: 3,
      currency: 'EUR',
      unitPriceMinor: '1001',
      subtotalMinor: '3003',
      discountMinor: '300',
      totalMinor: '2703',
      coupon: 'SAVE10',
      discountPercent: 10,
      note: 'Inspect this quote in Swagger',
    });
    assert.equal((await request('/api/products/WIDGET')).body.stock, 4);
  });
});

test("quotes: Some(0) and Some('') survive if-let; missing/null become absence", async () => {
  await withApplication(async ({ request }) => {
    const absent = await request('/api/quotes', { sku: 'WIDGET', quantity: 1 });
    const nullable = await request('/api/quotes', {
      sku: 'WIDGET',
      quantity: 1,
      coupon: null,
      note: null,
    });
    const explicit = await request('/api/quotes', {
      sku: 'WIDGET',
      quantity: 1,
      coupon: 'ZERO',
      note: '',
    });
    for (const response of [absent, nullable, explicit]) {
      assert.equal(response.status, 200);
      assert.equal(response.body.totalMinor, '1001');
      assert.equal(response.body.discountMinor, '0');
    }
    assert.deepEqual(nullable.body, absent.body);
    assert.equal(absent.body.coupon, null);
    assert.equal(absent.body.discountPercent, null);
    assert.equal(absent.body.note, null);
    assert.equal(explicit.body.coupon, 'ZERO');
    assert.equal(explicit.body.discountPercent, 0);
    assert.equal(explicit.body.note, '');
  });
});

test('quotes: invalid boundary values become 400 without mutating inventory', async () => {
  await withApplication(async ({ request }) => {
    for (const body of [
      {},
      { sku: 'WIDGET', quantity: 0 },
      { sku: 'WIDGET', quantity: -1 },
      { sku: 'WIDGET', quantity: 1.5 },
      { sku: 'WIDGET', quantity: '1' },
      { sku: 'WIDGET', quantity: Number.MAX_SAFE_INTEGER + 1 },
      { sku: 'bad sku', quantity: 1 },
      { sku: 'WIDGET', quantity: 1, coupon: false },
      { sku: 'WIDGET', quantity: 1, note: false },
    ]) {
      const result = await request('/api/quotes', body);
      assert.equal(result.status, 400, JSON.stringify(body));
      assert.equal(result.body.code, 'INVALID_INPUT', JSON.stringify(body));
    }
    const invalidCoupon = await request('/api/quotes', {
      sku: 'WIDGET',
      quantity: 1,
      coupon: 'EXPIRED',
    });
    assert.equal(invalidCoupon.status, 400);
    assert.equal(invalidCoupon.body.code, 'INVALID_COUPON');
    assert.equal((await request('/api/products/WIDGET')).body.stock, 4);
  });
});

test('quotes: missing products become 404 and quotes do not reserve stock', async () => {
  await withApplication(async ({ request }) => {
    const missing = await request('/api/quotes', {
      sku: 'MISSING',
      quantity: 1,
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'PRODUCT_NOT_FOUND');
    const first = await request('/api/quotes', { sku: 'WIDGET', quantity: 3 });
    const second = await request('/api/quotes', { sku: 'WIDGET', quantity: 3 });
    assert.equal(first.status, 200);
    assert.deepEqual(first, second);
    assert.equal((await request('/api/products/WIDGET')).body.stock, 4);
  });
});

test('reservations: reserve, read, and reject insufficient stock without mutation', async () => {
  await withApplication(async ({ request }) => {
    const created = await request('/api/reservations', {
      sku: 'WIDGET',
      quantity: 3,
      coupon: 'SAVE10',
      idempotencyKey: 'order-001',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.id, 'reservation-1');
    assert.equal(created.body.status, 'confirmed');
    assert.equal(created.body.quote.totalMinor, '2703');
    assert.equal(created.body.remainingStock, 1);
    assert.equal((await request('/api/products/WIDGET')).body.stock, 1);
    assert.deepEqual(await request(`/api/reservations/${created.body.id}`), {
      status: 200,
      body: created.body,
    });
    const insufficient = await request('/api/reservations', {
      sku: 'WIDGET',
      quantity: 2,
      idempotencyKey: 'order-002',
    });
    assert.equal(insufficient.status, 409);
    assert.equal(insufficient.body.code, 'INSUFFICIENT_STOCK');
    assert.equal((await request('/api/products/WIDGET')).body.stock, 1);
    // A rejected reservation does not consume its key or allocate an ID.
    const retried = await request('/api/reservations', {
      sku: 'WIDGET',
      quantity: 1,
      idempotencyKey: 'order-002',
    });
    assert.equal(retried.status, 201);
    assert.equal(retried.body.id, 'reservation-2');
    assert.equal(retried.body.remainingStock, 0);
    assert.equal((await request('/api/products/WIDGET')).body.stock, 0);
  });
});

test('reservations: missing product, empty stock, invalid input, and missing ID remain distinct', async () => {
  await withApplication(async ({ request }) => {
    for (const [body, status, code] of [
      [
        { sku: 'MISSING', quantity: 1, idempotencyKey: 'missing' },
        404,
        'PRODUCT_NOT_FOUND',
      ],
      [
        { sku: 'EMPTY', quantity: 1, idempotencyKey: 'empty' },
        409,
        'INSUFFICIENT_STOCK',
      ],
      [
        { sku: 'WIDGET', quantity: 0, idempotencyKey: 'invalid' },
        400,
        'INVALID_INPUT',
      ],
      [{ sku: 'WIDGET', quantity: 1 }, 400, 'INVALID_INPUT'],
      [
        { sku: 'WIDGET', quantity: 1, idempotencyKey: '' },
        400,
        'INVALID_INPUT',
      ],
    ]) {
      const result = await request('/api/reservations', body);
      assert.equal(result.status, status);
      assert.equal(result.body.code, code);
    }
    const missing = await request('/api/reservations/reservation-missing');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'RESERVATION_NOT_FOUND');
    assert.equal((await request('/api/products/WIDGET')).body.stock, 4);
  });
});

test('reservations: idempotent replay succeeds after stock reaches zero; changed payload conflicts', async () => {
  await withApplication(async ({ request }) => {
    const input = {
      sku: 'WIDGET',
      quantity: 4,
      coupon: 'ZERO',
      note: '',
      idempotencyKey: 'checkout-exactly-once',
    };
    const first = await request('/api/reservations', input);
    assert.equal(first.status, 201);
    assert.equal(first.body.remainingStock, 0);
    assert.deepEqual(await request('/api/reservations', input), first);
    const conflict = await request('/api/reservations', {
      ...input,
      quantity: 3,
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await request('/api/products/WIDGET')).body.stock, 0);
    assert.deepEqual(
      (await request(`/api/reservations/${first.body.id}`)).body,
      first.body,
    );
  });
});

test('reservations: canonical null/missing fields replay; explicit zero coupon remains a different request', async () => {
  await withApplication(async ({ request }) => {
    const input = { sku: 'WIDGET', quantity: 1, idempotencyKey: 'canonical' };
    const first = await request('/api/reservations', input);
    assert.equal(first.status, 201);
    assert.deepEqual(
      await request('/api/reservations', {
        ...input,
        coupon: null,
        note: null,
      }),
      first,
    );
    const conflict = await request('/api/reservations', {
      ...input,
      coupon: 'ZERO',
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await request('/api/products/WIDGET')).body.stock, 3);
  });
});

test('native emit: Nest resolves class metadata and the services expose the installed Typers runtime', async () => {
  await withApplication(async ({ app }) => {
    assert.ok(
      Reflect.getMetadata('design:paramtypes', QuotesService).includes(
        CatalogRepository,
      ),
    );
    assert.ok(
      Reflect.getMetadata('design:paramtypes', ReservationsService).includes(
        QuotesService,
      ),
    );
    const catalog = app.get(CatalogRepository);
    const quotes = app.get(QuotesService);
    const reservations = app.get(ReservationsService);
    assert.ok(catalog instanceof CatalogRepository);
    assert.ok(quotes instanceof QuotesService);
    assert.ok(reservations instanceof ReservationsService);
    assert.strictEqual(catalog.find('MISSING'), None);
    assert.deepEqual(
      catalog.find('EMPTY'),
      Some(catalog.list().find((product) => product.sku === 'EMPTY')),
    );
    const success = quotes.quote({ sku: 'WIDGET', quantity: 1 });
    assert.equal(success.kind, 'ok');
    assert.equal(success.value.totalMinor, '1001');
    const failure = quotes.quote({ sku: 'WIDGET', quantity: 0 });
    assert.equal(failure.kind, 'err');
    assert.equal(failure.error.code, 'INVALID_INPUT');
    assert.strictEqual(reservations.find('missing'), None);
  });
});

test('Swagger: the running application documents usable products, quotes, and reservations routes', async () => {
  await withApplication(async ({ base, request }) => {
    const response = await request('/openapi.json');
    assert.equal(response.status, 200);
    assert.match(response.body.openapi, /^3\./);
    for (const [path, method] of [
      ['/api/products', 'get'],
      ['/api/products/{sku}', 'get'],
      ['/api/quotes', 'post'],
      ['/api/reservations', 'post'],
      ['/api/reservations/{id}', 'get'],
      ['/api/policy', 'get'],
    ]) {
      assert.ok(
        response.body.paths[path]?.[method],
        `${method.toUpperCase()} ${path}`,
      );
    }
    const swagger = await fetch(`${base}/docs`, {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(swagger.status, 200);
    assert.match(await swagger.text(), /swagger-ui/i);
  });
});

test('Nest adapter: the running policy endpoint reads its copied build asset', async () => {
  await withApplication(async ({ request }) => {
    const response = await request('/api/policy');
    assert.equal(response.status, 200);
    assert.equal(response.body.currency, 'EUR');
    assert.deepEqual(response.body.coupons, { SAVE10: 10, ZERO: 0 });
    assert.equal(response.body.storage, 'in-memory');
    assert.equal(response.body.payments, false);
    assert.deepEqual(
      response.body,
      JSON.parse(
        await readFile(
          new URL('../dist/assets/policy.json', import.meta.url),
          'utf8',
        ),
      ),
    );
  });
});

test('native emit: executable services lower if-let and declarations keep domain contracts', async () => {
  const emitted = await readFile(
    new URL('../dist/quotes/quotes.service.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(emitted, /if\s+let\s+Some/);
  const declaration = await readFile(
    new URL('../dist/quotes/quotes.service.d.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    declaration,
    /quote\(input: unknown\): Result<Quote, DomainError>/,
  );
  assert.doesNotMatch(declaration, /__typers_iflet_/);
  const source = await readFile(
    new URL('../src/quotes/quotes.service.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /if\s+let\s+Some/);
  const sourceMap = JSON.parse(
    await readFile(
      new URL('../dist/quotes/quotes.service.js.map', import.meta.url),
      'utf8',
    ),
  );
  assert.deepEqual(sourceMap.sourcesContent, [source]);
  assert.ok(sourceMap.mappings.length > 0);
  const declarationMap = JSON.parse(
    await readFile(
      new URL('../dist/quotes/quotes.service.d.ts.map', import.meta.url),
      'utf8',
    ),
  );
  assert.ok(
    declarationMap.sources.some((path) => path.endsWith('quotes.service.ts')),
  );
  assert.ok(declarationMap.mappings.length > 0);
});
