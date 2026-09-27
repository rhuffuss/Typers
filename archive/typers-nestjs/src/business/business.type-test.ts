import type { ExpenseCommand } from './business.service.js';
import type { SuccessOf, DomainResult } from './business-errors.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
export type SuccessIsPreserved = Expect<
  Equal<SuccessOf<DomainResult<{ id: string }>>, { id: string }>
>;

export const approveCommand: ExpenseCommand = {
  kind: 'approve',
  input: { expectedVersion: 1 },
};
export const payCommand: ExpenseCommand = {
  kind: 'pay',
  input: { expectedVersion: 2, idempotencyKey: 'invoice-1' },
};
// @ts-expect-error A payment command cannot omit its idempotency key.
export const paymentWithoutKey: ExpenseCommand = {
  kind: 'pay',
  input: { expectedVersion: 2 },
};
// @ts-expect-error Rejections must carry their business reason.
export const rejectionWithoutReason: ExpenseCommand = {
  kind: 'reject',
  input: { expectedVersion: 2 },
};
export const unknownCommand: ExpenseCommand = {
  // @ts-expect-error Workflow actions form a closed union, not arbitrary strings.
  kind: 'erase',
  input: { expectedVersion: 2 },
};
