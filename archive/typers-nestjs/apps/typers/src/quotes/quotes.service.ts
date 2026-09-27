import { Injectable } from '@nestjs/common';
import { Err, Ok, fromNullable, type Result } from '@typers/core';
import { CatalogRepository } from '../catalog/catalog.repository.js';
import type { Product } from '../catalog/product.js';
import type { DomainError } from '../domain-error.js';
import { parseQuoteInput } from './quote-input.js';
import type { Quote, QuoteInput } from './quote.js';

@Injectable()
export class QuotesService {
  readonly #discounts = new Map<string, number>([
    ['ZERO', 0],
    ['SAVE10', 10],
  ]);

  // Nest resolves the class from Typers-emitted design:paramtypes metadata.
  constructor(private readonly catalog: CatalogRepository) {}

  quote(input: unknown): Result<Quote, DomainError> {
    const parsed = parseQuoteInput(input);
    if (parsed.kind === 'err') return parsed;

    if let Some(product) = this.catalog.find(parsed.value.sku) {
      return this.price(product, parsed.value);
    } else {
      return Err({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found.',
        details: { sku: parsed.value.sku },
      });
    }
  }

  /** Quotes calculate prices without checking or consuming inventory. */
  private price(product: Product, input: QuoteInput): Result<Quote, DomainError> {
    let coupon: string | null = null;
    let discountPercent: number | null = null;
    if let Some(code) = input.coupon {
      // Some(0) matches too: a zero-rate coupon is different from an unknown one.
      if let Some(percent) = fromNullable(this.#discounts.get(code)) {
        coupon = code;
        discountPercent = percent;
      } else {
        return Err({
          code: 'INVALID_COUPON',
          message: 'Coupon was not found.',
          details: { coupon: code },
        });
      }
    }
    let note: string | null = null;
    if let Some(value) = input.note {
      note = value;
    }

    const subtotal = BigInt(product.unitPriceMinor) * BigInt(input.quantity);
    // Whole minor units, rounded down. BigInt never crosses the JSON boundary.
    const discount = (subtotal * BigInt(discountPercent ?? 0)) / 100n;
    return Ok(
      Object.freeze({
        sku: product.sku,
        quantity: input.quantity,
        currency: product.currency,
        unitPriceMinor: product.unitPriceMinor,
        subtotalMinor: subtotal.toString(),
        discountMinor: discount.toString(),
        totalMinor: (subtotal - discount).toString(),
        coupon,
        discountPercent,
        note,
      }),
    );
  }
}
