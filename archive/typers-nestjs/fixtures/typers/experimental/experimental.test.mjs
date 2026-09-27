import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { None, Some } from '@typers/core';
import {
  asynchronous,
  controlFlow,
  evaluateOnce,
  hygieneAndShadowing,
  inspect,
  knownVariants,
  mutatePayload,
  structural,
} from './dist/src/semantics.js';
import {
  ReservationsController,
  ReservationsService,
  StockRepository,
  createDemoApp,
} from './dist/src/nest-app.js';

const require = createRequire(import.meta.url);
const { presentUnits } = require('./dist/src/commonjs.cjs');

test('if-let: Some/None and all falsy payloads, including explicit undefined', () => {
  for (const value of [0, -0, false, '', null, undefined, NaN]) {
    const observed = inspect(Some(value));
    assert.equal(observed.matched, true);
    assert.ok(Object.is(observed.value, value));
  }
  assert.deepEqual(inspect(None), { matched: false });
  assert.equal(knownVariants(), 9);
});

test('if-let: evaluate RHS once for both branches and preserve thrown exceptions', () => {
  let calls = 0;
  assert.deepEqual(
    evaluateOnce(() => {
      calls++;
      return Some(0);
    }),
    [0],
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    evaluateOnce(() => {
      calls++;
      return None;
    }),
    [],
  );
  assert.equal(calls, 2);
  const failure = new Error('lookup failed');
  assert.throws(
    () =>
      evaluateOnce(() => {
        throw failure;
      }),
    (error) => error === failure,
  );
});

test('if-let: structural producer, narrowed payload, nested patterns and hygienic temporaries', () => {
  assert.equal(structural({ kind: 'some', value: 'restock' }), 'RESTOCK');
  assert.equal(structural({ kind: 'none' }), 'ABSENT');
  assert.equal(hygieneAndShadowing(), 34);
  assert.deepEqual(mutatePayload(), { count: 1 });
});

test('if-let: explicit await success/absence/rejection without implicit error conversion', async () => {
  let calls = 0;
  assert.equal(
    await asynchronous(() => {
      calls++;
      return Promise.resolve(Some(0));
    }),
    0,
  );
  assert.equal(calls, 1);
  assert.equal(await asynchronous(() => Promise.resolve(None)), 'absent');
  const failure = new Error('async unavailable');
  await assert.rejects(
    asynchronous(() => Promise.reject(failure)),
    (error) => error === failure,
  );
});

test('if-let: labeled loops, early return, finally, this and arguments retain semantics', () => {
  assert.deepEqual(controlFlow(), {
    total: 2,
    finalized: 5,
    early: 8,
    receiver: 8,
  });
});

test('if-let: CommonJS .cts emits executable .cjs with cross-format Option', () => {
  assert.equal(presentUnits(Some(0)), 0);
  assert.equal(presentUnits(Some(4)), 4);
  assert.equal(presentUnits(None), -1);
});

test('native declarations and source maps retain public types and original experimental source', async () => {
  const source = await readFile(
    new URL('./src/semantics.ts', import.meta.url),
    'utf8',
  );
  const declaration = await readFile(
    new URL('./dist/src/semantics.d.ts', import.meta.url),
    'utf8',
  );
  assert.match(declaration, /inspect<T>\(option: Option<T>\)/);
  assert.doesNotMatch(declaration, /__typers_iflet_|if let/);
  const map = JSON.parse(
    await readFile(
      new URL('./dist/src/semantics.js.map', import.meta.url),
      'utf8',
    ),
  );
  assert.deepEqual(map.sourcesContent, [source]);
  assert.ok(map.mappings.length > 0);
  const declarationMap = JSON.parse(
    await readFile(
      new URL('./dist/src/semantics.d.ts.map', import.meta.url),
      'utf8',
    ),
  );
  assert.ok(
    declarationMap.sources.some((name) => name.endsWith('semantics.ts')),
  );
  assert.ok(declarationMap.mappings.length > 0);
});

test('Nest emitted ESM: real DI metadata, HTTP reservation, error mapping and zero/absent stock', async () => {
  assert.deepEqual(
    Reflect.getMetadata('design:paramtypes', ReservationsService),
    [StockRepository],
  );
  assert.deepEqual(
    Reflect.getMetadata('design:paramtypes', ReservationsController),
    [ReservationsService, StockRepository],
  );
  const app = await createDemoApp();
  try {
    const base = await app.getUrl();
    const repository = app.get(StockRepository);
    const request = async (path, body) => {
      const response = await fetch(
        `${base}${path}`,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            },
      );
      return { status: response.status, body: await response.json() };
    };
    assert.deepEqual(await request('/stock/EMPTY'), {
      status: 200,
      body: { kind: 'some', value: 0 },
    });
    assert.deepEqual(await request('/stock/MISSING'), {
      status: 404,
      body: { code: 'UNKNOWN_SKU', sku: 'MISSING' },
    });
    const before = repository.lookups;
    assert.deepEqual(
      await request('/reservations', { sku: 'WIDGET', units: 2, note: '' }),
      {
        status: 201,
        body: {
          id: 'reservation-1',
          sku: 'WIDGET',
          units: 2,
          remaining: 2,
          note: { kind: 'some', value: '' },
        },
      },
    );
    assert.equal(
      repository.lookups,
      before + 1,
      'if-let RHS performs exactly one repository lookup',
    );
    assert.deepEqual(
      await request('/reservations', { sku: 'WIDGET', units: 3 }),
      {
        status: 409,
        body: { code: 'INSUFFICIENT_STOCK', sku: 'WIDGET', available: 2 },
      },
    );
    assert.deepEqual(
      await request('/reservations', { sku: 'WIDGET', units: 2, note: null }),
      {
        status: 201,
        body: {
          id: 'reservation-2',
          sku: 'WIDGET',
          units: 2,
          remaining: 0,
          note: { kind: 'none' },
        },
      },
    );
    assert.deepEqual(
      await request('/reservations', { sku: 'WIDGET', units: 1 }),
      {
        status: 409,
        body: { code: 'INSUFFICIENT_STOCK', sku: 'WIDGET', available: 0 },
      },
    );
    assert.deepEqual(
      await request('/reservations', { sku: 'MISSING', units: 1 }),
      {
        status: 404,
        body: { code: 'UNKNOWN_SKU', sku: 'MISSING' },
      },
    );
    const beforeInvalid = repository.lookups;
    for (const [body, field] of [
      [{ sku: 'WIDGET', units: 0 }, 'units'],
      [{ sku: 'WIDGET', units: '2' }, 'units'],
      [{ sku: 'WIDGET', units: 1, note: false }, 'note'],
      [{ sku: 'bad sku', units: 1 }, 'sku'],
    ])
      assert.deepEqual(await request('/reservations', body), {
        status: 400,
        body: { code: 'INVALID_INPUT', field },
      });
    assert.equal(
      repository.lookups,
      beforeInvalid,
      'invalid input never reaches the repository',
    );
  } finally {
    await app.close();
  }
});
