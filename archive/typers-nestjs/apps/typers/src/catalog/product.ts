export interface Product {
  readonly sku: string;
  readonly name: string;
  readonly currency: 'EUR';
  /** Decimal strings at the JSON boundary; arithmetic uses BigInt. */
  readonly unitPriceMinor: string;
  readonly stock: number;
}
