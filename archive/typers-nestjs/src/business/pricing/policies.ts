import { CATALOG, COUPONS, PLAN_RATES } from './catalog.js';
import type { Coupon, Plan, Sku } from './catalog.js';
import { roundRatio } from './money.js';
import { assertNever } from './result.js';
import type { Adjustment } from './types.js';

export type WorkingLine = Readonly<{
  sku: Sku;
  quantity: number;
  unitMinor: bigint;
  subtotalMinor: bigint;
  netMinor: bigint;
}>;
export type DiscountPolicy =
  | { readonly kind: 'plan'; readonly plan: Plan }
  | { readonly kind: 'volume' }
  | { readonly kind: 'coupon'; readonly coupon: Coupon };

/** Largest remainders conserve every minor unit; SKU breaks ties deterministically. */
export function allocateMinor(
  total: bigint,
  weights: readonly Readonly<{ key: string; weight: bigint }>[],
): bigint[] {
  const sum = weights.reduce((acc, item) => acc + item.weight, 0n);
  if (total < 0n || weights.some((item) => item.weight < 0n) || total > sum)
    throw new RangeError(
      'Allocation requires 0 <= total <= nonnegative weights.',
    );
  if (sum === 0n) return weights.map(() => 0n);
  const parts = weights.map(({ key, weight }, index) => ({
    index,
    key,
    minor: (total * weight) / sum,
    remainder: (total * weight) % sum,
  }));
  let leftover = total - parts.reduce((acc, part) => acc + part.minor, 0n);
  const ranked = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.key < b.key
        ? -1
        : a.key > b.key
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const part of ranked) {
    if (leftover === 0n) break;
    part.minor += 1n;
    leftover -= 1n;
  }
  return parts.map((part) => part.minor);
}

const sum = (values: readonly bigint[]) =>
  values.reduce((acc, value) => acc + value, 0n);
const volumeRate = (quantity: number) =>
  quantity >= 100 ? 1500 : quantity >= 25 ? 1000 : quantity >= 10 ? 500 : 0;

function percentageProposal(
  lines: readonly WorkingLine[],
  eligible: (line: WorkingLine) => boolean,
  rateBps: number,
) {
  const weights = lines.map((line) => ({
    key: line.sku,
    weight: eligible(line) ? line.netMinor : 0n,
  }));
  return allocateMinor(
    roundRatio(
      sum(weights.map((item) => item.weight)),
      BigInt(rateBps),
      10000n,
    ),
    weights,
  );
}

export function proposeDiscount(
  policy: DiscountPolicy,
  lines: readonly WorkingLine[],
): readonly bigint[] {
  switch (policy.kind) {
    case 'plan':
      return percentageProposal(
        lines,
        (line) => CATALOG[line.sku].category !== 'physical',
        PLAN_RATES[policy.plan],
      );
    case 'volume':
      return lines.map((line) =>
        CATALOG[line.sku].volumeEligible
          ? roundRatio(line.netMinor, BigInt(volumeRate(line.quantity)), 10000n)
          : 0n,
      );
    case 'coupon': {
      const coupon = COUPONS[policy.coupon];
      const weights = lines.map((line) => ({
        key: line.sku,
        weight:
          coupon.physicalEligible || CATALOG[line.sku].category !== 'physical'
            ? line.netMinor
            : 0n,
      }));
      const eligible = sum(weights.map((item) => item.weight));
      const amount =
        coupon.kind === 'fixed'
          ? coupon.amountMinor < eligible
            ? coupon.amountMinor
            : eligible
          : roundRatio(eligible, BigInt(coupon.basisPoints), 10000n);
      return allocateMinor(amount, weights);
    }
    default:
      return assertNever(policy);
  }
}

type DiscountState = Readonly<{
  lines: readonly WorkingLine[];
  adjustments: readonly Adjustment[];
  usedMinor: bigint;
}>;

export function applyDiscounts(
  lines: readonly WorkingLine[],
  policies: readonly DiscountPolicy[],
  maximumMinor: bigint,
): DiscountState {
  return policies.reduce<DiscountState>(
    (state, policy) => {
      const proposed = proposeDiscount(policy, state.lines);
      const requested = sum(proposed);
      const allowance = maximumMinor - state.usedMinor;
      const actual = requested < allowance ? requested : allowance;
      const allocated = allocateMinor(
        actual,
        state.lines.map((line, index) => ({
          key: line.sku,
          weight: proposed[index],
        })),
      );
      return {
        lines: state.lines.map((line, index) => ({
          ...line,
          netMinor: line.netMinor - allocated[index],
        })),
        usedMinor: state.usedMinor + actual,
        adjustments: [
          ...state.adjustments,
          {
            kind: policy.kind,
            label:
              policy.kind === 'coupon'
                ? policy.coupon
                : policy.kind === 'plan'
                  ? policy.plan
                  : 'per-sku-volume-tiers',
            requestedMinor: requested.toString(),
            discountMinor: actual.toString(),
            capped: actual < requested,
          },
        ],
      };
    },
    { lines, adjustments: [], usedMinor: 0n },
  );
}
