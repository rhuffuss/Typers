import {
  Err,
  None,
  Ok,
  Some,
  fromNullable,
  type Option,
  type Result,
} from '@typers/core';
import { invalidInput, type DomainError } from '../domain-error.js';
import type { QuoteInput } from './quote.js';

/** JSON has no static types: narrow unknown before creating the domain value. */
export function parseQuoteInput(input: unknown): Result<QuoteInput, DomainError> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return Err(invalidInput('body', 'The request body must be an object.'));
  }
  if (
    !('sku' in input) ||
    typeof input.sku !== 'string' ||
    !/^[A-Z][A-Z0-9-]{0,31}$/.test(input.sku)
  ) {
    return Err(
      invalidInput(
        'sku',
        'SKU must contain 1–32 uppercase letters, digits or hyphens.',
      ),
    );
  }
  if (
    !('quantity' in input) ||
    typeof input.quantity !== 'number' ||
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1
  ) {
    return Err(
      invalidInput('quantity', 'Quantity must be a positive safe integer.'),
    );
  }

  let coupon: Option<string> = None;
  if let Some(value) = fromNullable('coupon' in input ? input.coupon : undefined) {
    if (typeof value !== 'string' || value.length > 32) {
      return Err(
        invalidInput(
          'coupon',
          'Coupon must be a string of at most 32 characters.',
        ),
      );
    }
    coupon = Some(value);
  }

  let note: Option<string> = None;
  if let Some(value) = fromNullable('note' in input ? input.note : undefined) {
    if (typeof value !== 'string' || value.length > 120) {
      return Err(
        invalidInput('note', 'Note must be a string of at most 120 characters.'),
      );
    }
    // Some('') remains present. Missing and null inputs both become None.
    note = Some(value);
  }
  return Ok({ sku: input.sku, quantity: input.quantity, coupon, note });
}
