import {
  getPricingCatalog,
  parseQuoteInput,
  quote,
  quoteUnknown,
} from './index.js';
import type { PricingErrorCode, QuoteInput } from './index.js';

const valid = {
  currency: 'EUR',
  plan: 'team',
  items: [{ sku: 'api-build', quantity: 12 }],
  coupon: 'WELCOME10',
} as const satisfies QuoteInput;
function quoted(input: QuoteInput) {
  const result = quote(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe('Service/project quotation rules', () => {
  it('orders plan, volume and coupon discounts, then applies the fee and demo taxes', () => {
    const result = quoted(valid);
    expect(result.totals).toEqual({
      subtotalMinor: '72000',
      discountMinor: '13518',
      netMinor: '58482',
      serviceFeeMinor: '1500',
      shippingMinor: '0',
      lineTaxMinor: '11696',
      serviceFeeTaxMinor: '300',
      shippingTaxMinor: '0',
      taxMinor: '11996',
      totalMinor: '71978',
    });
    expect(
      result.adjustments.map((item) => [item.kind, item.discountMinor]),
    ).toEqual([
      ['plan', '3600'],
      ['volume', '3420'],
      ['coupon', '6498'],
    ]);
    expect(result.lines[0]).toMatchObject({
      netMinor: '58482',
      discountMinor: '13518',
      demoTaxBps: 2000,
      totalMinor: '70178',
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('caps aggregate stacked discounts at 30% without changing earlier policies', () => {
    const result = quoted({
      currency: 'EUR',
      plan: 'enterprise',
      items: [{ sku: 'support-seat', quantity: 100 }],
      coupon: 'TEAM20',
    });
    expect(result.totals).toMatchObject({
      subtotalMinor: '290000',
      discountMinor: '87000',
      netMinor: '203000',
      totalMinor: '223300',
    });
    expect(result.adjustments).toEqual([
      {
        kind: 'plan',
        label: 'enterprise',
        requestedMinor: '29000',
        discountMinor: '29000',
        capped: false,
      },
      {
        kind: 'volume',
        label: 'per-sku-volume-tiers',
        requestedMinor: '39150',
        discountMinor: '39150',
        capped: false,
      },
      {
        kind: 'coupon',
        label: 'TEAM20',
        requestedMinor: '44370',
        discountMinor: '18850',
        capped: true,
      },
    ]);
  });

  it.each([
    [9, '0'],
    [10, '1450'],
    [24, '3480'],
    [25, '7250'],
    [99, '28710'],
    [100, '43500'],
  ])('applies the per-SKU quantity tier at %i seats', (quantity, discount) => {
    const result = quoted({
      currency: 'EUR',
      items: [{ sku: 'support-seat', quantity: quantity as number }],
    });
    expect(
      result.adjustments.find((item) => item.kind === 'volume')?.discountMinor,
    ).toBe(discount);
  });

  it('allocates fixed coupons across categories and is independent of input order', () => {
    const input = {
      currency: 'EUR',
      coupon: 'SAVE2500',
      items: [
        { sku: 'workshop', quantity: 1 },
        { sku: 'support-seat', quantity: 1 },
      ],
    } as const satisfies QuoteInput;
    const first = quoted(input);
    expect(first).toEqual(
      quoted({ ...input, items: [...input.items].reverse() }),
    );
    expect(
      first.lines.map((line) => [line.sku, line.discountMinor, line.taxMinor]),
    ).toEqual([
      ['support-seat', '137', '276'],
      ['workshop', '2363', '9527'],
    ]);
    expect(first.totals.totalMinor).toBe('62003');
    expect(input.items[0].sku).toBe('workshop');
  });

  it('computes shipping after coupons, including loss of the free-shipping threshold', () => {
    const items = [{ sku: 'onboarding-kit', quantity: 4 }] as const;
    expect(quoted({ currency: 'EUR', items }).totals).toMatchObject({
      shippingMinor: '0',
      totalMinor: '31500',
    });
    expect(
      quoted({ currency: 'EUR', items, coupon: 'SAVE2500' }).totals,
    ).toMatchObject({
      shippingMinor: '1200',
      shippingTaxMinor: '60',
      totalMinor: '30135',
    });
    expect(
      quoted({ currency: 'EUR', items, delivery: 'express' }).totals,
    ).toMatchObject({ shippingMinor: '2500', totalMinor: '34125' });
  });

  it('applies a fee floor, percentage, ceiling and enterprise waiver to service net value', () => {
    expect(
      quoted({ currency: 'EUR', items: [{ sku: 'api-build', quantity: 1 }] })
        .totals.serviceFeeMinor,
    ).toBe('1500');
    expect(
      quoted({
        currency: 'EUR',
        items: [{ sku: 'security-audit', quantity: 1 }],
      }).totals.serviceFeeMinor,
    ).toBe('2400');
    expect(
      quoted({ currency: 'EUR', items: [{ sku: 'workshop', quantity: 10 }] })
        .totals.serviceFeeMinor,
    ).toBe('7500');
    const enterprise = quoted({
      currency: 'EUR',
      plan: 'enterprise',
      items: [{ sku: 'security-audit', quantity: 1 }],
    });
    expect(enterprise.totals.serviceFeeMinor).toBe('0');
    expect(enterprise.rulesApplied).toContain('service-fee-enterprise-waiver');
  });

  it('uses independent USD prices and compares budget against the all-in total', () => {
    const usd = quoted({
      currency: 'USD',
      items: [{ sku: 'api-build', quantity: 1 }],
    });
    expect(usd.lines[0].unitPriceMinor).toBe('7000');
    expect(usd.totals.totalMinor).toBe('10200');
    expect(quote({ ...valid, budgetMinor: '71978' }).ok).toBe(true);
    expect(quote({ ...valid, budgetMinor: '71977' })).toMatchObject({
      ok: false,
      error: {
        code: 'BUDGET_EXCEEDED',
        details: { excessMinor: '1', requiredMinor: '71978' },
      },
    });
  });

  it('projects the catalog without bigint values and produces read-only results', () => {
    const catalog = getPricingCatalog();
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
    expect(catalog.items).toHaveLength(5);
    const output = quoted(valid);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.lines[0])).toBe(true);
    expect(Object.isFrozen(output.totals)).toBe(true);
  });
});

describe('Unknown-input and business rejection boundaries', () => {
  const cases: readonly [string, unknown, PricingErrorCode][] = [
    ['null', null, 'INVALID_INPUT'],
    ['extra root field', { ...valid, exchangeRate: 1 }, 'INVALID_INPUT'],
    ['currency', { ...valid, currency: 'JPY' }, 'INVALID_INPUT'],
    ['missing items', { currency: 'EUR' }, 'INVALID_INPUT'],
    ['empty items', { currency: 'EUR', items: [] }, 'INVALID_INPUT'],
    [
      'too many lines',
      { ...valid, items: Array(6).fill(valid.items[0]) },
      'INVALID_INPUT',
    ],
    ['unknown plan', { ...valid, plan: 'vip' }, 'INVALID_INPUT'],
    ['unknown delivery', { ...valid, delivery: 'drone' }, 'INVALID_INPUT'],
    [
      'unknown SKU',
      { ...valid, items: [{ sku: 'unknown', quantity: 1 }] },
      'UNKNOWN_SKU',
    ],
    [
      'prototype SKU',
      { ...valid, items: [{ sku: 'toString', quantity: 1 }] },
      'UNKNOWN_SKU',
    ],
    ['line is null', { ...valid, items: [null] }, 'INVALID_INPUT'],
    [
      'extra line field',
      { ...valid, items: [{ sku: 'api-build', quantity: 1, unitPrice: 1 }] },
      'INVALID_INPUT',
    ],
    [
      'negative',
      { ...valid, items: [{ sku: 'api-build', quantity: -1 }] },
      'INVALID_QUANTITY',
    ],
    [
      'zero',
      { ...valid, items: [{ sku: 'api-build', quantity: 0 }] },
      'INVALID_QUANTITY',
    ],
    [
      'fraction',
      { ...valid, items: [{ sku: 'api-build', quantity: 1.1 }] },
      'INVALID_QUANTITY',
    ],
    [
      'string quantity',
      { ...valid, items: [{ sku: 'api-build', quantity: '1' }] },
      'INVALID_QUANTITY',
    ],
    [
      'unsafe quantity',
      {
        ...valid,
        items: [{ sku: 'api-build', quantity: Number.MAX_SAFE_INTEGER + 1 }],
      },
      'INVALID_QUANTITY',
    ],
    [
      'NaN',
      { ...valid, items: [{ sku: 'api-build', quantity: NaN }] },
      'INVALID_QUANTITY',
    ],
    [
      'SKU cap',
      { ...valid, items: [{ sku: 'api-build', quantity: 161 }] },
      'INVALID_QUANTITY',
    ],
    [
      'duplicate',
      { ...valid, items: [valid.items[0], valid.items[0]] },
      'DUPLICATE_SKU',
    ],
    [
      'stock',
      { ...valid, items: [{ sku: 'onboarding-kit', quantity: 13 }] },
      'OUT_OF_STOCK',
    ],
    ['unknown coupon', { ...valid, coupon: 'FAKE' }, 'INVALID_COUPON'],
    [
      'coupon plan',
      { ...valid, plan: 'starter', coupon: 'TEAM20' },
      'COUPON_NOT_APPLICABLE',
    ],
    [
      'coupon categories',
      {
        currency: 'EUR',
        items: [{ sku: 'onboarding-kit', quantity: 1 }],
        coupon: 'WELCOME10',
      },
      'COUPON_NOT_APPLICABLE',
    ],
    [
      'coupon minimum',
      {
        currency: 'EUR',
        items: [{ sku: 'support-seat', quantity: 1 }],
        coupon: 'WELCOME10',
      },
      'COUPON_MINIMUM',
    ],
    [
      'delivery categories',
      { ...valid, delivery: 'express' },
      'DELIVERY_NOT_APPLICABLE',
    ],
    ['budget number', { ...valid, budgetMinor: 1 }, 'INVALID_INPUT'],
    ['budget negative', { ...valid, budgetMinor: '-1' }, 'INVALID_MONEY'],
    ['budget precision', { ...valid, budgetMinor: '1.99' }, 'INVALID_MONEY'],
    [
      'budget overflow',
      { ...valid, budgetMinor: '1000000000000' },
      'MONEY_OVERFLOW',
    ],
    ['budget zero', { ...valid, budgetMinor: '0' }, 'BUDGET_EXCEEDED'],
  ];
  it.each(cases)('rejects %s explicitly', (_name, input, code) => {
    const result = quoteUnknown(input);
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('validates even typed callers and freezes a copied boundary value', () => {
    expect(
      quote({ ...valid, items: [{ sku: 'api-build', quantity: -1 }] }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    const parsed = parseQuoteInput(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(Object.isFrozen(parsed.value.items)).toBe(true);
      expect(parsed.value.items).not.toBe(valid.items);
    }
  });

  it('accepts exact catalog stock and quantity limits', () => {
    expect(
      quote({
        currency: 'EUR',
        items: [{ sku: 'onboarding-kit', quantity: 12 }],
      }).ok,
    ).toBe(true);
    expect(
      quote({
        currency: 'USD',
        items: [{ sku: 'support-seat', quantity: 250 }],
      }).ok,
    ).toBe(true);
  });
});
