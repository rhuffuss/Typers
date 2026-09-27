import { failure, success } from './result.js';
import type { Result } from './result.js';

export const CURRENCIES = ['EUR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const MAX_MINOR = 999_999_999_999n;
declare const moneyBrand: unique symbol;

/** The phantom currency brand is created only after checking the minor units. */
export type Money<C extends Currency> = Readonly<{
  currency: C;
  minor: bigint;
  [moneyBrand]: C;
}>;
export type MoneyError = Readonly<{
  code:
    | 'INVALID_MONEY'
    | 'MONEY_OVERFLOW'
    | 'NEGATIVE_MONEY'
    | 'CURRENCY_MISMATCH'
    | 'INVALID_RATIO';
  message: string;
}>;

export function createMoney<C extends Currency>(
  currency: C,
  input: bigint | string,
): Result<Money<C>, MoneyError> {
  if (!(CURRENCIES as readonly string[]).includes(currency))
    return failure({
      code: 'INVALID_MONEY',
      message: 'Currency must be EUR or USD.',
    });
  if (
    typeof input !== 'bigint' &&
    (typeof input !== 'string' || !/^(0|[1-9]\d*)$/.test(input))
  )
    return failure({
      code: 'INVALID_MONEY',
      message:
        'Minor units must be a canonical unsigned integer string or bigint.',
    });
  // Reject huge strings before parsing them into an arbitrary-precision integer.
  if (typeof input === 'string' && input.length > MAX_MINOR.toString().length)
    return failure({
      code: 'MONEY_OVERFLOW',
      message: 'Amount exceeds the demo monetary limit.',
    });
  const minor = BigInt(input);
  if (minor < 0n)
    return failure({
      code: 'NEGATIVE_MONEY',
      message: 'Money cannot be negative.',
    });
  if (minor > MAX_MINOR)
    return failure({
      code: 'MONEY_OVERFLOW',
      message: 'Amount exceeds the demo monetary limit.',
    });
  return success(Object.freeze({ currency, minor }) as Money<C>);
}

/** NoInfer prevents the second operand widening EUR into EUR | USD. */
export function addMoney<C extends Currency>(
  left: Money<C>,
  right: Money<NoInfer<C>>,
): Result<Money<C>, MoneyError> {
  if (left.currency !== right.currency)
    return failure({
      code: 'CURRENCY_MISMATCH',
      message: 'Money operands must have the same currency.',
    });
  return createMoney(left.currency, left.minor + right.minor);
}

export function subtractMoney<C extends Currency>(
  left: Money<C>,
  right: Money<NoInfer<C>>,
): Result<Money<C>, MoneyError> {
  if (left.currency !== right.currency)
    return failure({
      code: 'CURRENCY_MISMATCH',
      message: 'Money operands must have the same currency.',
    });
  return createMoney(left.currency, left.minor - right.minor);
}

export function multiplyMoney<C extends Currency>(
  value: Money<C>,
  quantity: bigint,
): Result<Money<C>, MoneyError> {
  if (quantity < 0n)
    return failure({
      code: 'NEGATIVE_MONEY',
      message: 'Quantity cannot be negative.',
    });
  return createMoney(value.currency, value.minor * quantity);
}

/** Nonnegative rational amounts round half-up, with no floating-point arithmetic. */
export function roundRatio(
  value: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (value < 0n || numerator < 0n || denominator <= 0n)
    throw new RangeError(
      'roundRatio requires nonnegative values and a positive denominator.',
    );
  const product = value * numerator;
  return (product + denominator / 2n) / denominator;
}

export function percentageMoney<C extends Currency>(
  value: Money<C>,
  basisPoints: number,
): Result<Money<C>, MoneyError> {
  if (
    !Number.isSafeInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > 10000
  )
    return failure({
      code: 'INVALID_RATIO',
      message: 'Basis points must be an integer from 0 to 10000.',
    });
  return createMoney(
    value.currency,
    roundRatio(value.minor, BigInt(basisPoints), 10000n),
  );
}

export function serializeMoney<C extends Currency>(value: Money<C>) {
  return {
    currency: value.currency,
    minor: value.minor.toString(),
    decimal: `${value.minor / 100n}.${(value.minor % 100n).toString().padStart(2, '0')}`,
  } as const;
}
