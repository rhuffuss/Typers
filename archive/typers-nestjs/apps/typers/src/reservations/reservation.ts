import type { Quote } from '../quotes/quote.js';

export interface Reservation {
  readonly id: string;
  readonly status: 'confirmed';
  readonly idempotencyKey: string;
  readonly quote: Quote;
  /** Stock immediately after creation; replay returns this original receipt. */
  readonly remainingStock: number;
}

export interface StoredReservation {
  readonly fingerprint: string;
  readonly reservation: Reservation;
}
