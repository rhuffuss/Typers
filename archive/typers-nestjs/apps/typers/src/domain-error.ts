export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'PRODUCT_NOT_FOUND'
  | 'RESERVATION_NOT_FOUND'
  | 'INVALID_COUPON'
  | 'INSUFFICIENT_STOCK'
  | 'IDEMPOTENCY_CONFLICT';

/** Expected business failures are values; the HTTP layer chooses the status. */
export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number>>;
}

export function invalidInput(field: string, message: string): DomainError {
  return { code: 'INVALID_INPUT', message, details: { field } };
}
