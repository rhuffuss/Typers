import { CATALOG, COUPONS } from './catalog.js';
import { addMoney, createMoney, multiplyMoney, roundRatio } from './money.js';
import { applyDiscounts } from './policies.js';
import type { DiscountPolicy, WorkingLine } from './policies.js';
import { andThen, failure, success } from './result.js';
import type { Result } from './result.js';
import type { PricingError, Quote, QuoteInput } from './types.js';
import { parseQuoteInput } from './validation.js';

/** Pure and defensive even for callers bypassing the TypeScript boundary. */
export function quote(input: QuoteInput): Result<Quote, PricingError> {
  return andThen(parseQuoteInput(input), calculateQuote);
}

export function quoteUnknown(input: unknown): Result<Quote, PricingError> {
  return andThen(parseQuoteInput(input), calculateQuote);
}

function calculateQuote(input: QuoteInput): Result<Quote, PricingError> {
  const plan = input.plan ?? 'starter';
  const lines: WorkingLine[] = [];
  let subtotalMoney = createMoney(input.currency, 0n);
  if (!subtotalMoney.ok) return subtotalMoney;
  // Canonical order makes both allocations and JSON independent of input ordering.
  for (const item of [...input.items].sort((a, b) =>
    a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0,
  )) {
    const unit = createMoney(
      input.currency,
      CATALOG[item.sku].prices[input.currency],
    );
    if (!unit.ok) return unit;
    const lineAmount = multiplyMoney(unit.value, BigInt(item.quantity));
    if (!lineAmount.ok) return lineAmount;
    subtotalMoney = addMoney(subtotalMoney.value, lineAmount.value);
    if (!subtotalMoney.ok) return subtotalMoney;
    lines.push({
      ...item,
      unitMinor: unit.value.minor,
      subtotalMinor: lineAmount.value.minor,
      netMinor: lineAmount.value.minor,
    });
  }
  const subtotal = subtotalMoney.value.minor;
  const policies: DiscountPolicy[] = [
    { kind: 'plan', plan },
    { kind: 'volume' },
  ];
  if (input.coupon) {
    const coupon = COUPONS[input.coupon];
    if (
      !(coupon.plans as readonly string[]).includes(plan) ||
      !lines.some(
        (line) =>
          coupon.physicalEligible || CATALOG[line.sku].category !== 'physical',
      )
    )
      return failure({
        code: 'COUPON_NOT_APPLICABLE',
        message: 'The coupon does not apply to this plan or these items.',
        path: 'coupon',
      });
    if (subtotal < coupon.minimumMinor)
      return failure({
        code: 'COUPON_MINIMUM',
        message: 'The basket is below the coupon minimum.',
        path: 'coupon',
        details: { minimumMinor: coupon.minimumMinor.toString() },
      });
    policies.push({ kind: 'coupon', coupon: input.coupon });
  }
  const discounts = applyDiscounts(
    lines,
    policies,
    roundRatio(subtotal, 3000n, 10000n),
  );
  const net = subtotal - discounts.usedMinor;
  const serviceNet = discounts.lines
    .filter((line) => CATALOG[line.sku].category === 'service')
    .reduce((sum, line) => sum + line.netMinor, 0n);
  const physicalNet = discounts.lines
    .filter((line) => CATALOG[line.sku].category === 'physical')
    .reduce((sum, line) => sum + line.netMinor, 0n);
  const rules = [
    'catalog-prices',
    'plan-before-volume-before-coupon',
    'discount-cap-30-percent',
    'line-tax-half-up-demo',
  ];
  let fee = 0n;
  if (serviceNet > 0n && plan !== 'enterprise') {
    const percentage = roundRatio(serviceNet, 200n, 10000n);
    fee = percentage < 1500n ? 1500n : percentage > 7500n ? 7500n : percentage;
    rules.push(
      percentage < 1500n
        ? 'service-fee-minimum'
        : percentage > 7500n
          ? 'service-fee-capped'
          : 'service-fee-percentage',
    );
  } else
    rules.push(
      plan === 'enterprise' && serviceNet > 0n
        ? 'service-fee-enterprise-waiver'
        : 'service-fee-no-services',
    );
  let shipping = 0n;
  if (physicalNet === 0n) {
    if (input.delivery === 'express')
      return failure({
        code: 'DELIVERY_NOT_APPLICABLE',
        message: 'Express shipping requires a physical item.',
        path: 'delivery',
      });
    rules.push('shipping-no-physical-items');
  } else if (input.delivery === 'express') {
    shipping = 2500n;
    rules.push('shipping-express');
  } else if (physicalNet >= 30000n) rules.push('shipping-free-standard');
  else {
    shipping = 1200n;
    rules.push('shipping-standard');
  }
  const outputLines = discounts.lines.map((line) => {
    const product = CATALOG[line.sku];
    const tax = roundRatio(line.netMinor, BigInt(product.demoTaxBps), 10000n);
    return Object.freeze({
      sku: line.sku,
      name: product.name,
      category: product.category,
      quantity: line.quantity,
      unitPriceMinor: line.unitMinor.toString(),
      subtotalMinor: line.subtotalMinor.toString(),
      discountMinor: (line.subtotalMinor - line.netMinor).toString(),
      netMinor: line.netMinor.toString(),
      demoTaxBps: product.demoTaxBps,
      taxMinor: tax.toString(),
      totalMinor: (line.netMinor + tax).toString(),
    });
  });
  const lineTax = outputLines.reduce(
    (sum, line) => sum + BigInt(line.taxMinor),
    0n,
  );
  const feeTax = roundRatio(fee, 2000n, 10000n);
  const shippingTax = roundRatio(shipping, 500n, 10000n);
  const tax = lineTax + feeTax + shippingTax;
  const total = createMoney(input.currency, net + fee + shipping + tax);
  if (!total.ok) return total;
  if (
    input.budgetMinor !== undefined &&
    total.value.minor > BigInt(input.budgetMinor)
  )
    return failure({
      code: 'BUDGET_EXCEEDED',
      message: 'The total including demo taxes and fees exceeds the budget.',
      path: 'budgetMinor',
      details: {
        budgetMinor: input.budgetMinor,
        requiredMinor: total.value.minor.toString(),
        excessMinor: (total.value.minor - BigInt(input.budgetMinor)).toString(),
      },
    });
  return success(
    Object.freeze({
      currency: input.currency,
      plan,
      lines: Object.freeze(outputLines),
      adjustments: Object.freeze(
        discounts.adjustments.map((adjustment) => Object.freeze(adjustment)),
      ),
      totals: Object.freeze({
        subtotalMinor: subtotal.toString(),
        discountMinor: discounts.usedMinor.toString(),
        netMinor: net.toString(),
        serviceFeeMinor: fee.toString(),
        shippingMinor: shipping.toString(),
        lineTaxMinor: lineTax.toString(),
        serviceFeeTaxMinor: feeTax.toString(),
        shippingTaxMinor: shippingTax.toString(),
        taxMinor: tax.toString(),
        totalMinor: total.value.minor.toString(),
      }),
      rulesApplied: Object.freeze(rules),
    }),
  );
}
