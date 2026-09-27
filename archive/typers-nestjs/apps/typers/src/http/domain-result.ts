import { HttpException, HttpStatus } from '@nestjs/common';
import type { Result } from '@typers/core';
import type { DomainError } from '../domain-error.js';

function statusFor(error: DomainError): HttpStatus {
  switch (error.code) {
    case 'INVALID_INPUT':
    case 'INVALID_COUPON':
      return HttpStatus.BAD_REQUEST;
    case 'PRODUCT_NOT_FOUND':
    case 'RESERVATION_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'INSUFFICIENT_STOCK':
    case 'IDEMPOTENCY_CONFLICT':
      return HttpStatus.CONFLICT;
    default: {
      const unhandled: never = error.code;
      throw new Error(`Unhandled domain error: ${unhandled}`);
    }
  }
}

/** HTTP translates the typed domain errors; services do not throw HTTP errors. */
export function domainException(error: DomainError): HttpException {
  const statusCode = statusFor(error);
  return new HttpException({ statusCode, ...error }, statusCode);
}

export function respond<T>(result: Result<T, DomainError>): T {
  if result.kind === 'ok' return result.value;
  throw domainException(result.error);
}
