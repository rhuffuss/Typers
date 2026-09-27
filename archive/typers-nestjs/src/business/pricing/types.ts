import type { Category, Coupon, Plan, Sku } from './catalog.js';
import type { Currency, MoneyError } from './money.js';

export type QuoteInput = Readonly<{
  currency: Currency;
  plan?: Plan;
  items: readonly Readonly<{ sku: Sku; quantity: number }>[];
  coupon?: Coupon;
  delivery?: 'standard' | 'express';
  budgetMinor?: string;
}>;

export type PricingErrorCode =
  | MoneyError['code']
  | 'INVALID_INPUT'
  | 'UNKNOWN_SKU'
  | 'INVALID_QUANTITY'
  | 'DUPLICATE_SKU'
  | 'OUT_OF_STOCK'
  | 'INVALID_COUPON'
  | 'COUPON_NOT_APPLICABLE'
  | 'COUPON_MINIMUM'
  | 'DELIVERY_NOT_APPLICABLE'
  | 'BUDGET_EXCEEDED';
export type PricingError = Readonly<{
  code: PricingErrorCode;
  message: string;
  path?: string;
  details?: Readonly<Record<string, string | number>>;
}>;

export type QuoteLine = Readonly<{
  sku: Sku;
  name: string;
  category: Category;
  quantity: number;
  unitPriceMinor: string;
  subtotalMinor: string;
  discountMinor: string;
  netMinor: string;
  demoTaxBps: number;
  taxMinor: string;
  totalMinor: string;
}>;
export type DiscountKind = 'plan' | 'volume' | 'coupon';
export type Adjustment = Readonly<{
  kind: DiscountKind;
  label: string;
  requestedMinor: string;
  discountMinor: string;
  capped: boolean;
}>;
export type Quote = Readonly<{
  currency: Currency;
  plan: Plan;
  lines: readonly QuoteLine[];
  adjustments: readonly Adjustment[];
  totals: Readonly<{
    subtotalMinor: string;
    discountMinor: string;
    netMinor: string;
    serviceFeeMinor: string;
    shippingMinor: string;
    lineTaxMinor: string;
    serviceFeeTaxMinor: string;
    shippingTaxMinor: string;
    taxMinor: string;
    totalMinor: string;
  }>;
  rulesApplied: readonly string[];
}>;
