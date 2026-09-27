import { Injectable } from '@nestjs/common';
import { Err, Ok, type Option, type Result } from '@typers/core';
import { CatalogRepository } from '../catalog/catalog.repository.js';
import { invalidInput, type DomainError } from '../domain-error.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { Reservation } from './reservation.js';
import { ReservationsRepository } from './reservations.repository.js';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly quotes: QuotesService,
    private readonly catalog: CatalogRepository,
    private readonly reservations: ReservationsRepository,
  ) {}

  list(): Reservation[] {
    return this.reservations.list();
  }

  find(id: string): Option<Reservation> {
    return this.reservations.find(id);
  }

  reserve(input: unknown): Result<Reservation, DomainError> {
    const key = parseIdempotencyKey(input);
    if (key.kind === 'err') return key;
    const priced = this.quotes.quote(input);
    if (priced.kind === 'err') return priced;

    const quote = priced.value;
    // Property order in incoming JSON is irrelevant; null and missing normalize.
    const fingerprint = JSON.stringify([
      quote.sku,
      quote.quantity,
      quote.coupon,
      quote.note,
    ]);
    if let Some(previous) = this.reservations.findByKey(key.value) {
      if (previous.fingerprint !== fingerprint) {
        return Err({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'This idempotency key already belongs to a different request.',
          details: { idempotencyKey: key.value },
        });
      }
      return Ok(previous.reservation);
    }

    // No await separates stock validation from the writes in this memory app.
    // A persistent, multi-instance implementation would require a transaction.
    const stock = this.catalog.decrement(quote.sku, quote.quantity);
    if (stock.kind === 'err') return stock;
    return Ok(
      this.reservations.create(quote, key.value, fingerprint, stock.value.stock),
    );
  }
}

function parseIdempotencyKey(input: unknown): Result<string, DomainError> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return Err(invalidInput('body', 'The request body must be an object.'));
  }
  if (
    !('idempotencyKey' in input) ||
    typeof input.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(input.idempotencyKey)
  ) {
    return Err(
      invalidInput(
        'idempotencyKey',
        'Idempotency key must contain 1–80 letters, digits, underscores or hyphens.',
      ),
    );
  }
  return Ok(input.idempotencyKey);
}
