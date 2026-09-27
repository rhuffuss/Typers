import { addMoney, multiplyMoney, quote, serializeMoney } from './index.js';
import type {
  Currency,
  Money,
  Quote,
  QuoteInput,
  Result,
  PricingError,
  Sku,
} from './index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
export type SupportedSkuAssertion = Expect<
  Equal<
    Sku,
    | 'api-build'
    | 'security-audit'
    | 'support-seat'
    | 'onboarding-kit'
    | 'workshop'
  >
>;
export type MoneyCurrencyAssertion = Expect<
  Equal<Money<'EUR'>['currency'], 'EUR'>
>;

/** Compile-time fixture only: Vitest does not discover or invoke this function. */
export function pricingTypeContracts(
  eur: Money<'EUR'>,
  usd: Money<'USD'>,
  input: QuoteInput,
  result: Result<Quote, PricingError>,
): void {
  const sum = addMoney(eur, eur) satisfies Result<Money<'EUR'>, unknown>;
  const multiple = multiplyMoney(usd, 2n) satisfies Result<
    Money<'USD'>,
    unknown
  >;
  const serialized = serializeMoney(eur);
  const currency: 'EUR' = serialized.currency;
  const sameCurrency: Currency = currency;
  // @ts-expect-error NoInfer prevents widening the first currency from the second operand.
  addMoney(eur, usd);
  // @ts-expect-error A plain object cannot forge the unique-symbol currency brand.
  const forged: Money<'EUR'> = { currency: 'EUR', minor: 1n };
  // @ts-expect-error Branded money stores bigint, never floating-point numbers.
  const numeric: Money<'EUR'> = { currency: 'EUR', minor: 1 };
  // @ts-expect-error Unsupported currencies are excluded from the generic domain.
  const unsupported: Money<'JPY'> = eur;
  // @ts-expect-error readonly inputs cannot be mutated by pricing strategies.
  input.items.push({ sku: 'api-build', quantity: 1 });
  // @ts-expect-error Budget wire amounts must be integer strings.
  quote({ currency: 'EUR', items: [], budgetMinor: 1 });
  // @ts-expect-error A misspelled SKU does not satisfy the catalog-derived union.
  const unknownSku: Sku = 'consulting';
  if (result.ok) {
    const total: string = result.value.totals.totalMinor;
    // @ts-expect-error Success variants do not contain an error.
    void result.error;
    void {
      sum,
      multiple,
      sameCurrency,
      total,
      forged,
      numeric,
      unsupported,
      unknownSku,
    };
    return;
  }
  const error: PricingError = result.error;
  // @ts-expect-error Failure variants do not contain a quote value.
  void result.value;
  void error;
}
