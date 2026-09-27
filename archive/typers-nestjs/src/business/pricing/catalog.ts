import type { Currency } from './money.js';

type CatalogItem = Readonly<{
  name: string;
  category: 'service' | 'subscription' | 'physical';
  prices: Readonly<Record<Currency, bigint>>;
  maxQuantity: number;
  stock?: number;
  volumeEligible: boolean;
  demoTaxBps: number;
}>;

/** Prices are independent catalog prices, never an exchange-rate conversion. */
export const CATALOG = {
  'api-build': {
    name: 'API development hour',
    category: 'service',
    prices: { EUR: 6000n, USD: 7000n },
    maxQuantity: 160,
    volumeEligible: true,
    demoTaxBps: 2000,
  },
  'security-audit': {
    name: 'Application security audit',
    category: 'service',
    prices: { EUR: 120000n, USD: 140000n },
    maxQuantity: 3,
    volumeEligible: false,
    demoTaxBps: 2000,
  },
  'support-seat': {
    name: 'Monthly support seat',
    category: 'subscription',
    prices: { EUR: 2900n, USD: 3200n },
    maxQuantity: 250,
    volumeEligible: true,
    demoTaxBps: 1000,
  },
  'onboarding-kit': {
    name: 'Printed onboarding kit',
    category: 'physical',
    prices: { EUR: 7500n, USD: 8500n },
    maxQuantity: 20,
    stock: 12,
    volumeEligible: false,
    demoTaxBps: 500,
  },
  workshop: {
    name: 'Team workshop',
    category: 'service',
    prices: { EUR: 50000n, USD: 60000n },
    maxQuantity: 10,
    volumeEligible: false,
    demoTaxBps: 2000,
  },
} as const satisfies Record<string, CatalogItem>;

export type Sku = keyof typeof CATALOG;
export type Category = (typeof CATALOG)[Sku]['category'];
export const PLAN_RATES = { starter: 0, team: 500, enterprise: 1000 } as const;
export type Plan = keyof typeof PLAN_RATES;
export const COUPONS = {
  WELCOME10: {
    kind: 'percentage',
    basisPoints: 1000,
    minimumMinor: 5000n,
    plans: ['starter', 'team', 'enterprise'],
    physicalEligible: false,
  },
  TEAM20: {
    kind: 'percentage',
    basisPoints: 2000,
    minimumMinor: 50000n,
    plans: ['team', 'enterprise'],
    physicalEligible: false,
  },
  SAVE2500: {
    kind: 'fixed',
    amountMinor: 2500n,
    minimumMinor: 20000n,
    plans: ['starter', 'team', 'enterprise'],
    physicalEligible: true,
  },
} as const satisfies Record<
  string,
  Readonly<{
    kind: 'percentage' | 'fixed';
    basisPoints?: number;
    amountMinor?: bigint;
    minimumMinor: bigint;
    plans: readonly Plan[];
    physicalEligible: boolean;
  }>
>;
export type Coupon = keyof typeof COUPONS;

/** Public catalog projection keeps bigint implementation details off the wire. */
export function getPricingCatalog() {
  return {
    currencies: ['EUR', 'USD'] as const,
    plans: Object.entries(PLAN_RATES).map(([id, discountBps]) => ({
      id,
      discountBps,
    })),
    items: Object.entries(CATALOG).map(([sku, item]) => ({
      sku,
      name: item.name,
      category: item.category,
      pricesMinor: {
        EUR: item.prices.EUR.toString(),
        USD: item.prices.USD.toString(),
      },
      maximumQuantity: item.maxQuantity,
      ...('stock' in item ? { availableStock: item.stock } : {}),
      volumeEligible: item.volumeEligible,
      demoTaxBps: item.demoTaxBps,
    })),
    coupons: Object.entries(COUPONS).map(([code, coupon]) => ({
      code,
      kind: coupon.kind,
      minimumMinor: coupon.minimumMinor.toString(),
      plans: [...coupon.plans],
      physicalEligible: coupon.physicalEligible,
      ...('amountMinor' in coupon
        ? { amountMinor: coupon.amountMinor.toString() }
        : { basisPoints: coupon.basisPoints }),
    })),
    taxNotice: 'Fictional demo rates. This is not a tax calculation service.',
  };
}
