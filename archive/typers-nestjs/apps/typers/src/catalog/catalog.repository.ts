import { Injectable } from '@nestjs/common';
import { Err, Ok, fromNullable, type Option, type Result } from '@typers/core';
import { invalidInput, type DomainError } from '../domain-error.js';
import type { Product } from './product.js';

@Injectable()
export class CatalogRepository {
  readonly #products = new Map<string, Product>([
    [
      'WIDGET',
      Object.freeze({
        sku: 'WIDGET',
        name: 'Widget',
        currency: 'EUR',
        unitPriceMinor: '1001',
        stock: 4,
      }),
    ],
    [
      'EMPTY',
      Object.freeze({
        sku: 'EMPTY',
        name: 'Out-of-stock sample',
        currency: 'EUR',
        unitPriceMinor: '500',
        stock: 0,
      }),
    ],
  ]);

  list(): Product[] {
    return [...this.#products.values()];
  }

  find(sku: string): Option<Product> {
    return fromNullable(this.#products.get(sku));
  }

  /** Synchronous, single-process mutation: validate everything before writing. */
  decrement(sku: string, quantity: number): Result<Product, DomainError> {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return Err(
        invalidInput('quantity', 'Quantity must be a positive safe integer.'),
      );
    }
    if let Some(product) = this.find(sku) {
      if (quantity > product.stock) {
        return Err({
          code: 'INSUFFICIENT_STOCK',
          message: 'The requested quantity exceeds available stock.',
          details: { sku, requested: quantity, available: product.stock },
        });
      }
      const updated = Object.freeze({
        ...product,
        stock: product.stock - quantity,
      });
      this.#products.set(sku, updated);
      return Ok(updated);
    } else {
      return Err({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found.',
        details: { sku },
      });
    }
  }
}
