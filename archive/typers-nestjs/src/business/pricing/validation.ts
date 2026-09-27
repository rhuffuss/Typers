import { CATALOG, COUPONS, PLAN_RATES } from './catalog.js';
import type { Coupon, Plan, Sku } from './catalog.js';
import { createMoney } from './money.js';
import type { Currency } from './money.js';
import { failure, success } from './result.js';
import type { Result } from './result.js';
import type { PricingError, QuoteInput } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const owns = <T extends object>(value: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(value, key);
const invalid = (message: string, path: string): Result<never, PricingError> =>
  failure({ code: 'INVALID_INPUT', message, path });

/** No coercion: HTTP strings, fractions, unknown keys and duplicate SKUs are errors. */
export function parseQuoteInput(
  input: unknown,
): Result<QuoteInput, PricingError> {
  if (!isRecord(input)) return invalid('Quote input must be an object.', '$');
  const allowed = [
    'currency',
    'plan',
    'items',
    'coupon',
    'delivery',
    'budgetMinor',
  ];
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) return invalid('Unknown quote field.', key);
  if (input.currency !== 'EUR' && input.currency !== 'USD')
    return invalid('Currency must be EUR or USD.', 'currency');
  const currency: Currency = input.currency;
  if (
    input.plan !== undefined &&
    (typeof input.plan !== 'string' || !owns(PLAN_RATES, input.plan))
  )
    return invalid('Unknown customer plan.', 'plan');
  if (
    input.delivery !== undefined &&
    input.delivery !== 'standard' &&
    input.delivery !== 'express'
  )
    return invalid('Delivery must be standard or express.', 'delivery');
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0 ||
    input.items.length > Object.keys(CATALOG).length
  )
    return invalid('Supply one to five distinct catalog lines.', 'items');
  const seen = new Set<Sku>();
  const items: { sku: Sku; quantity: number }[] = [];
  for (const [index, candidate] of input.items.entries()) {
    const path = `items[${index}]`;
    if (!isRecord(candidate))
      return invalid('Each line must be an object.', path);
    for (const key of Object.keys(candidate))
      if (key !== 'sku' && key !== 'quantity')
        return invalid('Unknown line field.', `${path}.${key}`);
    if (typeof candidate.sku !== 'string' || !owns(CATALOG, candidate.sku))
      return failure({
        code: 'UNKNOWN_SKU',
        message: 'The item is not in the catalog.',
        path: `${path}.sku`,
      });
    const sku = candidate.sku;
    const product = CATALOG[sku];
    if (
      typeof candidate.quantity !== 'number' ||
      !Number.isSafeInteger(candidate.quantity) ||
      candidate.quantity < 1 ||
      candidate.quantity > product.maxQuantity
    )
      return failure({
        code: 'INVALID_QUANTITY',
        message: 'Quantity must be an integer within the catalog limit.',
        path: `${path}.quantity`,
        details: { maximum: product.maxQuantity },
      });
    if (seen.has(sku))
      return failure({
        code: 'DUPLICATE_SKU',
        message: 'Combine quantities into a single line per SKU.',
        path: `${path}.sku`,
      });
    if ('stock' in product && candidate.quantity > product.stock)
      return failure({
        code: 'OUT_OF_STOCK',
        message: 'Quantity exceeds available demo stock.',
        path: `${path}.quantity`,
        details: { available: product.stock },
      });
    seen.add(sku);
    items.push(Object.freeze({ sku, quantity: candidate.quantity }));
  }
  if (
    input.coupon !== undefined &&
    (typeof input.coupon !== 'string' || !owns(COUPONS, input.coupon))
  )
    return failure({
      code: 'INVALID_COUPON',
      message: 'Unknown coupon code.',
      path: 'coupon',
    });
  if (input.budgetMinor !== undefined) {
    if (typeof input.budgetMinor !== 'string')
      return invalid(
        'Budget must be an integer string in minor units.',
        'budgetMinor',
      );
    const budget = createMoney(currency, input.budgetMinor);
    if (!budget.ok) return failure({ ...budget.error, path: 'budgetMinor' });
  }
  return success(
    Object.freeze({
      currency,
      plan: (input.plan ?? 'starter') as Plan,
      items: Object.freeze(items),
      ...(input.coupon === undefined ? {} : { coupon: input.coupon as Coupon }),
      delivery: input.delivery ?? 'standard',
      ...(input.budgetMinor === undefined
        ? {}
        : { budgetMinor: input.budgetMinor }),
    }),
  );
}
