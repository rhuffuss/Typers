import {
  inspect,
  asynchronous,
  structural,
  knownVariants,
} from './dist/src/semantics.js';
import {
  parseReservation,
  type ReservationInput,
} from './dist/src/nest-app.js';
import { Some, type Result } from '@typers/core';

// Official TypeScript consumes emitted declarations without experimental syntax.
const inspected = inspect(Some(0));
if (inspected.matched) {
  const count: number = inspected.value;
  // @ts-expect-error Emitted generic declarations preserve the number payload.
  const text: string = inspected.value;
  void [count, text];
}
const asyncCount: Promise<number | 'absent'> = asynchronous(async () =>
  Some(0),
);
const name: string = structural({ kind: 'some', value: 'widget' });
const known: number = knownVariants();
const reservation = parseReservation({ sku: 'WIDGET', units: 1 });
if (reservation.kind === 'ok') reservation.value.units.toFixed();
// @ts-expect-error Public declarations preserve the Result error contract.
const wrongResult: Result<ReservationInput, string> = reservation;
void [asyncCount, name, known, wrongResult];
