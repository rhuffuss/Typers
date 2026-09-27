import { ExpenseMoney, ThresholdApprovalPolicy } from './approval-policy.js';
import type {
  CreateExpenseInput,
  ExpenseActor,
  ExpenseEvent,
  ExpenseResult,
  ExpenseSnapshot,
} from './contracts.js';
import { ExpenseRequest } from './expense-request.js';

/** Compile-only fixtures: not imported by the application or Vitest. */
export function typestateContracts(
  input: CreateExpenseInput,
  actor: ExpenseActor,
) {
  const policy = new ThresholdApprovalPolicy();
  const draft = ExpenseRequest.create(input, actor);
  const submitted = draft.submit(actor, policy);
  const reviewed = submitted.approve(actor, policy);
  if (reviewed.state === 'approved') {
    const paid: ExpenseRequest<'paid'> = reviewed.pay(actor, 'typed-payment');
    // @ts-expect-error A paid expense cannot be submitted again.
    paid.submit(actor, policy);
  }
  // @ts-expect-error Payment is available only for an approved expense.
  draft.pay(actor, 'typed-payment');
  // @ts-expect-error Approval requires a submitted expense.
  draft.approve(actor, policy);
  // @ts-expect-error The state getter is read-only.
  draft.state = 'paid';
  // @ts-expect-error A submitted expense is not a draft.
  const anotherDraft: ExpenseRequest<'draft'> = submitted;
  return anotherDraft;
}

export function structuralAndOverloadContracts() {
  const actorWithExtraFields = {
    id: 'structural',
    roles: ['member'],
    email: 'demo@example.test',
  };
  const actor: ExpenseActor = actorWithExtraFields;
  const money = ExpenseMoney.of({ amountMinor: 123, currency: 'EUR' });
  const other = ExpenseMoney.of(123, 'USD');
  // @ts-expect-error Numeric overload requires a currency.
  ExpenseMoney.of(123);
  // @ts-expect-error Only the supported currency union is accepted.
  ExpenseMoney.of(123, 'GBP');
  // @ts-expect-error The domain uses integer numbers, not monetary strings.
  ExpenseMoney.of('123', 'EUR');
  return { actor, money, other };
}

export function resultAndEventContracts(
  result: ExpenseResult<ExpenseSnapshot>,
  event: ExpenseEvent,
) {
  if (result.ok) {
    // @ts-expect-error Successful results do not contain an error.
    void result.error.code;
    return result.value.state;
  }
  // @ts-expect-error Failed results do not contain an expense.
  void result.value.state;
  if (event.type === 'expense.paid') {
    const paymentId: string = event.payload.paymentId;
    // @ts-expect-error Paid-event payload does not contain a rejection reason.
    void event.payload.reason;
    return paymentId;
  }
  return result.error.code;
}
