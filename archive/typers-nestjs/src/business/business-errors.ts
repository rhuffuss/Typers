import { HttpException } from '@nestjs/common';

export interface DomainError {
  readonly code: string;
  readonly message: string;
}
export type DomainResult<T, E extends DomainError = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
export type SuccessOf<R> = R extends {
  readonly ok: true;
  readonly value: infer T;
}
  ? T
  : never;

const httpStatuses = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  DUPLICATE_APPROVAL: 409,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  BUDGET_EXCEEDED: 422,
  OUT_OF_STOCK: 409,
} as const satisfies Readonly<Record<string, number>>;

function hasStatus(code: string): code is keyof typeof httpStatuses {
  return Object.hasOwn(httpStatuses, code);
}

export function requireSuccess<T, E extends DomainError>(
  result: DomainResult<T, E>,
  errorStatus?: (error: E) => number,
): T {
  if (result.ok) return result.value;
  const { code } = result.error;
  const status =
    errorStatus?.(result.error) ?? (hasStatus(code) ? httpStatuses[code] : 400);
  throw new HttpException({ ...result.error, statusCode: status }, status);
}

export function assertUnreachable(value: never): never {
  throw new Error(`Unexpected domain action: ${JSON.stringify(value)}`);
}
