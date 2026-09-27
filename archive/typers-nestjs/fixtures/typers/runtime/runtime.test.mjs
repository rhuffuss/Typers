import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as esm from '@typers/core';
import {
  createQuote,
  decodeStock,
  parseQuoteInput,
  quoteFromAsyncProvider,
  quoteFromProvider,
} from './dist/src/budget.js';

const require = createRequire(import.meta.url);
const { commonjsCore, reserve } = require('./dist/src/commonjs.cjs');

for (const [format, core] of [
  ['ESM', esm],
  ['CommonJS emitted .cts', commonjsCore],
]) {
  test(`${format}: all five runtime exports; falsy values remain present`, () => {
    assert.deepEqual(
      Object.keys(core).sort(),
      ['Err', 'None', 'Ok', 'Some', 'fromNullable'].sort(),
    );
    for (const value of [0, -0, false, '', null, undefined, NaN]) {
      const present = core.Some(value);
      assert.equal(present.kind, 'some');
      assert.ok(Object.is(present.value, value));
      assert.notEqual(present, core.None);
    }
  });

  test(`${format}: fromNullable, None and structural cross-format interoperability`, () => {
    assert.equal(core.fromNullable(null), core.None);
    assert.equal(core.fromNullable(undefined), core.None);
    for (const value of [0, false, '', NaN]) {
      const present = core.fromNullable(value);
      assert.equal(present.kind, 'some');
      assert.ok(Object.is(present.value, value));
    }
    assert.equal(Object.isFrozen(core.None), true);
    assert.equal(Reflect.set(core.None, 'kind', 'some'), false);
    // Compare variants, not module singleton identities.
    assert.deepEqual(reserve(1, core.None), {
      kind: 'err',
      error: 'UNKNOWN_SKU',
    });
    assert.deepEqual(reserve(1, core.Some(3)), { kind: 'ok', value: 2 });
  });

  test(`${format}: Ok/Err preserve references; readonly is not a deep freeze`, () => {
    const payload = { reserved: 1 };
    const success = core.Ok(payload);
    const present = core.Some(payload);
    payload.reserved = 2;
    assert.equal(success.value, payload);
    assert.equal(present.value, payload);
    assert.equal(success.value.reserved, 2);
    const failure = new Error('storage offline');
    assert.doesNotThrow(() => core.Err(failure));
    assert.equal(core.Err(failure).error, failure);
    assert.deepEqual(core.Err(undefined), { kind: 'err', error: undefined });
  });
}

test('budget: BigInt success, integer rounding, explicit zero and absent discount', () => {
  assert.deepEqual(
    createQuote({ units: 3, unitCents: '1001', discountPercent: 10 }, 3000n),
    {
      kind: 'ok',
      value: {
        subtotalCents: 3003n,
        discountCents: 300n,
        totalCents: 2703n,
        discount: 'explicit',
      },
    },
  );
  assert.equal(
    createQuote({ units: 1, unitCents: '0', discountPercent: 0 }, 0n).value
      .discount,
    'explicit',
  );
  assert.equal(
    createQuote({ units: 1, unitCents: '0' }, 0n).value.discount,
    'absent',
  );
  assert.equal(
    createQuote({ units: 1, unitCents: '0', discountPercent: null }, 0n).value
      .discount,
    'absent',
  );
  assert.equal(
    createQuote({ units: 1, unitCents: '9007199254740993' }, 9007199254740993n)
      .value.totalCents,
    9007199254740993n,
  );
});

test('budget: typed domain errors and unknown HTTP boundary validation', () => {
  assert.deepEqual(createQuote({ units: 2, unitCents: '500' }, 999n), {
    kind: 'err',
    error: { code: 'BUDGET_EXCEEDED', totalCents: '1000', budgetCents: '999' },
  });
  for (const [input, field] of [
    [null, 'body'],
    [[], 'body'],
    [{}, 'units'],
    [{ units: 1.1, unitCents: '1' }, 'units'],
    [{ units: 1, unitCents: 100 }, 'unitCents'],
    [{ units: 1, unitCents: '-1' }, 'unitCents'],
    [{ units: 1, unitCents: '100', discountPercent: false }, 'discountPercent'],
    [{ units: 1, unitCents: '100', discountPercent: 101 }, 'discountPercent'],
  ])
    assert.deepEqual(parseQuoteInput(input), {
      kind: 'err',
      error: { code: 'INVALID_INPUT', field },
    });
});

test('unknown structural Option: validate tags and payload before use', () => {
  assert.deepEqual(decodeStock(JSON.parse('{"kind":"some","value":0}')), {
    kind: 'ok',
    value: { kind: 'some', value: 0 },
  });
  assert.deepEqual(decodeStock({ kind: 'none' }), {
    kind: 'ok',
    value: { kind: 'none' },
  });
  for (const input of [
    null,
    {},
    { kind: 'some' },
    { kind: 'some', value: '7' },
    { kind: 'some', value: -1 },
    { kind: 'other' },
  ]) {
    assert.equal(decodeStock(input).kind, 'err');
  }
});

test('CJS consumer: success, error, absent product and zero stock', () => {
  assert.deepEqual(reserve(2, esm.Some(2)), esm.Ok(0));
  assert.deepEqual(reserve(1, esm.Some(0)), esm.Err('INSUFFICIENT_STOCK'));
  assert.deepEqual(reserve(1, esm.None), esm.Err('UNKNOWN_SKU'));
  assert.deepEqual(reserve(0, esm.Some(4)), esm.Err('INVALID_UNITS'));
});

test('Result does not implicitly catch thrown errors or rejected promises', async () => {
  const failure = new Error('provider unavailable');
  assert.throws(
    () =>
      quoteFromProvider(() => {
        throw failure;
      }),
    (error) => error === failure,
  );
  await assert.rejects(
    quoteFromAsyncProvider(() => Promise.reject(failure)),
    (error) => error === failure,
  );
  const success = await quoteFromAsyncProvider(() =>
    Promise.resolve({ units: 1, unitCents: '100' }),
  );
  assert.equal(success.kind, 'ok');
});
