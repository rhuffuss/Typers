import { Injectable } from '@nestjs/common';
import { fromNullable, type Option } from '@typers/core';
import type { Quote } from '../quotes/quote.js';
import type { Reservation, StoredReservation } from './reservation.js';

@Injectable()
export class ReservationsRepository {
  readonly #byId = new Map<string, Reservation>();
  readonly #byKey = new Map<string, StoredReservation>();
  #sequence = 0;

  list(): Reservation[] {
    return [...this.#byId.values()];
  }

  find(id: string): Option<Reservation> {
    return fromNullable(this.#byId.get(id));
  }

  findByKey(key: string): Option<StoredReservation> {
    return fromNullable(this.#byKey.get(key));
  }

  create(
    quote: Quote,
    key: string,
    fingerprint: string,
    remainingStock: number,
  ): Reservation {
    const reservation: Reservation = Object.freeze({
      id: `reservation-${++this.#sequence}`,
      status: 'confirmed',
      idempotencyKey: key,
      quote,
      remainingStock,
    });
    this.#byId.set(reservation.id, reservation);
    this.#byKey.set(key, { fingerprint, reservation });
    return reservation;
  }
}
