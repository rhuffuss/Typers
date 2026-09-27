import type { Option } from '@typers/core';

/** Validated internal input keeps absence explicit instead of using truthiness. */
export interface QuoteInput {
  readonly sku: string;
  readonly quantity: number;
  readonly coupon: Option<string>;
  readonly note: Option<string>;
}

export interface Quote {
  readonly sku: string;
  readonly quantity: number;
  readonly currency: 'EUR';
  readonly unitPriceMinor: string;
  readonly subtotalMinor: string;
  readonly discountMinor: string;
  readonly totalMinor: string;
  readonly coupon: string | null;
  readonly discountPercent: number | null;
  readonly note: string | null;
}
