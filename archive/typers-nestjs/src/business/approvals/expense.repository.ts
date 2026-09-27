import { failure, success } from './contracts.js';
import type { ExpenseResult } from './contracts.js';
import type { AnyExpenseRequest, ExpenseRequest } from './expense-request.js';

export interface ExpenseRepository {
  insert(
    expense: ExpenseRequest<'draft'>,
  ): Promise<ExpenseResult<AnyExpenseRequest>>;
  find(id: string): Promise<AnyExpenseRequest | undefined>;
  save(
    expense: AnyExpenseRequest,
    expectedVersion: number,
  ): Promise<ExpenseResult<AnyExpenseRequest>>;
  replayPayment(
    key: string,
    fingerprint: string,
  ): Promise<ExpenseResult<ExpenseRequest<'paid'>> | undefined>;
  commitPayment(
    expense: ExpenseRequest<'paid'>,
    expectedVersion: number,
    key: string,
    fingerprint: string,
  ): Promise<ExpenseResult<AnyExpenseRequest>>;
}

interface CompletedPayment {
  readonly fingerprint: string;
  readonly expense: ExpenseRequest<'paid'>;
}

/** Single-process lab repository: each compare/write section has no await. */
export class InMemoryExpenseRepository implements ExpenseRepository {
  readonly #expenses = new Map<string, AnyExpenseRequest>();
  readonly #payments = new Map<string, CompletedPayment>();

  insert(
    expense: ExpenseRequest<'draft'>,
  ): Promise<ExpenseResult<AnyExpenseRequest>> {
    if (this.#expenses.has(expense.id))
      return Promise.resolve(
        failure('VERSION_CONFLICT', 'Expense already exists'),
      );
    this.#expenses.set(expense.id, expense);
    return Promise.resolve(success(expense));
  }

  find(id: string): Promise<AnyExpenseRequest | undefined> {
    return Promise.resolve(this.#expenses.get(id));
  }

  save(
    expense: AnyExpenseRequest,
    expectedVersion: number,
  ): Promise<ExpenseResult<AnyExpenseRequest>> {
    return Promise.resolve(this.compareAndSwap(expense, expectedVersion));
  }

  replayPayment(
    key: string,
    fingerprint: string,
  ): Promise<ExpenseResult<ExpenseRequest<'paid'>> | undefined> {
    return Promise.resolve(this.existingPayment(key, fingerprint));
  }

  commitPayment(
    expense: ExpenseRequest<'paid'>,
    expectedVersion: number,
    key: string,
    fingerprint: string,
  ): Promise<ExpenseResult<AnyExpenseRequest>> {
    const replay = this.existingPayment(key, fingerprint);
    if (replay) return Promise.resolve(replay);
    const saved = this.compareAndSwap(expense, expectedVersion);
    if (saved.ok) this.#payments.set(key, { fingerprint, expense });
    return Promise.resolve(saved);
  }

  private existingPayment(
    key: string,
    fingerprint: string,
  ): ExpenseResult<ExpenseRequest<'paid'>> | undefined {
    const payment = this.#payments.get(key);
    if (!payment) return undefined;
    return payment.fingerprint === fingerprint
      ? success(payment.expense)
      : failure(
          'IDEMPOTENCY_CONFLICT',
          'The payment key has already been used for another command',
        );
  }

  private compareAndSwap(
    expense: AnyExpenseRequest,
    expectedVersion: number,
  ): ExpenseResult<AnyExpenseRequest> {
    const current = this.#expenses.get(expense.id);
    if (!current) return failure('NOT_FOUND', 'Expense was not found');
    if (
      current.version !== expectedVersion ||
      expense.version !== expectedVersion + 1
    ) {
      return failure(
        'VERSION_CONFLICT',
        `Expected version ${expectedVersion}; current version is ${current.version}`,
      );
    }
    this.#expenses.set(expense.id, expense);
    return success(expense);
  }
}
