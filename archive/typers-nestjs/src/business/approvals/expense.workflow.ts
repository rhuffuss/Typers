import { ApprovalPolicy } from './approval-policy.js';
import {
  ExpenseViolation,
  failure,
  hasRole,
  requireActor,
  requireIdempotencyKey,
  requireText,
  requireVersion,
  success,
} from './contracts.js';
import type {
  CreateExpenseInput,
  ExpenseActor,
  ExpenseResult,
  ExpenseSnapshot,
  PayExpenseInput,
  RejectExpenseInput,
  VersionedExpenseInput,
} from './contracts.js';
import { ExpenseRequest } from './expense-request.js';
import type { AnyExpenseRequest } from './expense-request.js';
import type { ExpenseRepository } from './expense.repository.js';

export class ExpenseWorkflow {
  constructor(
    private readonly repository: ExpenseRepository,
    private readonly policy: ApprovalPolicy,
  ) {}

  create(
    input: CreateExpenseInput,
    actor: ExpenseActor,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.perform(() =>
      this.repository.insert(ExpenseRequest.create(input, actor)),
    );
  }

  get(id: string): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.perform(async () => {
      const expense = await this.repository.find(requireText(id, 'Expense id'));
      return expense
        ? success(expense)
        : failure('NOT_FOUND', 'Expense was not found');
    });
  }

  submit(
    id: string,
    input: VersionedExpenseInput,
    actor: ExpenseActor,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.change(id, input, actor, (expense) => {
      if (expense.state !== 'draft')
        throw this.invalidTransition('submit', expense);
      return expense.submit(actor, this.policy);
    });
  }

  approve(
    id: string,
    input: VersionedExpenseInput,
    actor: ExpenseActor,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.change(id, input, actor, (expense) => {
      if (expense.state !== 'submitted')
        throw this.invalidTransition('approve', expense);
      return expense.approve(actor, this.policy);
    });
  }

  reject(
    id: string,
    input: RejectExpenseInput,
    actor: ExpenseActor,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.change(id, input, actor, (expense) => {
      if (expense.state !== 'submitted')
        throw this.invalidTransition('reject', expense);
      return expense.reject(actor, input.reason, this.policy);
    });
  }

  pay(
    id: string,
    input: PayExpenseInput,
    actor: ExpenseActor,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.perform(async () => {
      requireActor(actor);
      if (!hasRole(actor, 'finance', 'admin'))
        throw new ExpenseViolation(
          'FORBIDDEN',
          'Only finance or administrators can pay expenses',
        );
      requireText(id, 'Expense id');
      requireVersion(input?.expectedVersion);
      requireIdempotencyKey(input?.idempotencyKey);
      // Bind keys to the complete command; role revocation still denies a replay.
      const fingerprint = JSON.stringify([id, actor.id, input.expectedVersion]);
      const replay = await this.repository.replayPayment(
        input.idempotencyKey,
        fingerprint,
      );
      if (replay) return replay;
      let expense: AnyExpenseRequest;
      try {
        expense = await this.loadVersion(id, input.expectedVersion);
      } catch (error) {
        // Another request may have paid after our first idempotency lookup.
        if (
          error instanceof ExpenseViolation &&
          error.code === 'VERSION_CONFLICT'
        ) {
          const completed = await this.repository.replayPayment(
            input.idempotencyKey,
            fingerprint,
          );
          if (completed) return completed;
        }
        throw error;
      }
      if (expense.state !== 'approved')
        throw this.invalidTransition('pay', expense);
      return this.repository.commitPayment(
        expense.pay(actor, input.idempotencyKey),
        input.expectedVersion,
        input.idempotencyKey,
        fingerprint,
      );
    });
  }

  private change(
    id: string,
    input: VersionedExpenseInput,
    actor: ExpenseActor,
    transition: (expense: AnyExpenseRequest) => AnyExpenseRequest,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    return this.perform(async () => {
      requireActor(actor);
      requireText(id, 'Expense id');
      requireVersion(input?.expectedVersion);
      const expense = await this.loadVersion(id, input.expectedVersion);
      return this.repository.save(transition(expense), input.expectedVersion);
    });
  }

  private async loadVersion(
    id: string,
    expectedVersion: number,
  ): Promise<AnyExpenseRequest> {
    const expense = await this.repository.find(id);
    if (!expense)
      throw new ExpenseViolation('NOT_FOUND', 'Expense was not found');
    if (expense.version !== expectedVersion)
      throw new ExpenseViolation(
        'VERSION_CONFLICT',
        `Expected version ${expectedVersion}; current version is ${expense.version}`,
      );
    return expense;
  }

  private invalidTransition(
    operation: string,
    expense: AnyExpenseRequest,
  ): ExpenseViolation {
    return new ExpenseViolation(
      'INVALID_TRANSITION',
      `Cannot ${operation} an expense in ${expense.state} state`,
    );
  }

  private async perform(
    operation: () => Promise<ExpenseResult<AnyExpenseRequest>>,
  ): Promise<ExpenseResult<ExpenseSnapshot>> {
    try {
      const result = await operation();
      return result.ok ? success(result.value.toJSON()) : result;
    } catch (error) {
      if (error instanceof ExpenseViolation)
        return failure(error.code, error.message);
      throw error;
    }
  }
}
