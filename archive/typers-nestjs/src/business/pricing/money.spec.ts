import {
  addMoney,
  createMoney,
  MAX_MINOR,
  multiplyMoney,
  percentageMoney,
  serializeMoney,
  subtractMoney,
} from './money.js';
import type { Currency, Money } from './money.js';
import { allocateMinor } from './policies.js';

function money<C extends Currency>(currency: C, minor: bigint) {
  const result = createMoney(currency, minor);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('Branded money and integer rounding', () => {
  it('keeps large integer arithmetic exact and serializes minor units without BigInt', () => {
    const amount = money('EUR', MAX_MINOR);
    expect(percentageMoney(amount, 9999)).toMatchObject({
      ok: true,
      value: { minor: 999899999999n },
    });
    expect(serializeMoney(amount)).toEqual({
      currency: 'EUR',
      minor: '999999999999',
      decimal: '9999999999.99',
    });
    expect(
      JSON.parse(JSON.stringify(serializeMoney(money('USD', 1n)))),
    ).toEqual({ currency: 'USD', minor: '1', decimal: '0.01' });
  });

  it.each(['1.20', '-1', '+1', '01', '1e3', '', ' 10', '10 '])(
    'rejects noncanonical amount %j',
    (input) => {
      expect(createMoney('EUR', input)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_MONEY' },
      });
    },
  );

  it('rejects overflow on input, addition and multiplication and negative subtraction', () => {
    expect(createMoney('EUR', '9'.repeat(10000))).toMatchObject({
      ok: false,
      error: { code: 'MONEY_OVERFLOW' },
    });
    expect(addMoney(money('EUR', MAX_MINOR), money('EUR', 1n))).toMatchObject({
      ok: false,
      error: { code: 'MONEY_OVERFLOW' },
    });
    expect(multiplyMoney(money('EUR', MAX_MINOR), 2n)).toMatchObject({
      ok: false,
      error: { code: 'MONEY_OVERFLOW' },
    });
    expect(subtractMoney(money('EUR', 0n), money('EUR', 1n))).toMatchObject({
      ok: false,
      error: { code: 'NEGATIVE_MONEY' },
    });
    expect(multiplyMoney(money('EUR', 1n), -1n)).toMatchObject({
      ok: false,
      error: { code: 'NEGATIVE_MONEY' },
    });
  });

  it('enforces currency at runtime even when a caller has widened the generic', () => {
    const left: Money<Currency> = money('EUR', 100n);
    expect(addMoney(left, money('USD', 100n))).toMatchObject({
      ok: false,
      error: { code: 'CURRENCY_MISMATCH' },
    });
  });

  it('uses half-up ties and rejects invalid basis points', () => {
    expect(percentageMoney(money('EUR', 1n), 5000)).toMatchObject({
      ok: true,
      value: { minor: 1n },
    });
    expect(percentageMoney(money('EUR', 1n), 4999)).toMatchObject({
      ok: true,
      value: { minor: 0n },
    });
    expect(percentageMoney(money('EUR', 3n), 5000)).toMatchObject({
      ok: true,
      value: { minor: 2n },
    });
    for (const rate of [-1, 10001, 1.5, NaN, Infinity])
      expect(percentageMoney(money('EUR', 1n), rate)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_RATIO' },
      });
  });

  it('allocates remainders exactly and resolves equal remainders by stable key', () => {
    expect(
      allocateMinor(1n, [
        { key: 'b', weight: 1n },
        { key: 'a', weight: 1n },
      ]),
    ).toEqual([0n, 1n]);
    expect(
      allocateMinor(2500n, [
        { key: 'workshop', weight: 50000n },
        { key: 'support-seat', weight: 2900n },
      ]),
    ).toEqual([2363n, 137n]);
    expect(allocateMinor(0n, [{ key: 'a', weight: 0n }])).toEqual([0n]);
    expect(() => allocateMinor(2n, [{ key: 'a', weight: 1n }])).toThrow(
      RangeError,
    );
  });

  it('conserves every unit and never overdraws a line across many allocation ratios', () => {
    for (let a = 0n; a <= 10n; a++)
      for (let b = 0n; b <= 10n; b++)
        for (let total = 0n; total <= a + b; total++) {
          const parts = allocateMinor(total, [
            { key: 'a', weight: a },
            { key: 'b', weight: b },
          ]);
          expect(parts[0] + parts[1]).toBe(total);
          expect(parts[0] >= 0n && parts[0] <= a).toBe(true);
          expect(parts[1] >= 0n && parts[1] <= b).toBe(true);
        }
  });
});
