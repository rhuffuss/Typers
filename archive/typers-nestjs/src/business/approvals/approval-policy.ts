import { ExpenseViolation, hasRole } from './contracts.js';
import type {
  ApprovalRecord,
  ApprovalRequirements,
  Currency,
  ExpenseActor,
} from './contracts.js';

export interface MoneyInput {
  readonly amountMinor: number;
  readonly currency: Currency;
}

export class ExpenseMoney {
  readonly #amountMinor: number;
  readonly #currency: Currency;

  private constructor(amountMinor: number, currency: Currency) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new ExpenseViolation(
        'INVALID_INPUT',
        'amountMinor must be a positive safe integer',
      );
    }
    if (currency !== 'EUR' && currency !== 'USD') {
      throw new ExpenseViolation(
        'INVALID_INPUT',
        'currency must be EUR or USD',
      );
    }
    this.#amountMinor = amountMinor;
    this.#currency = currency;
  }

  static of(input: MoneyInput): ExpenseMoney;
  static of(amountMinor: number, currency: Currency): ExpenseMoney;
  static of(input: number | MoneyInput, currency?: Currency): ExpenseMoney {
    if (typeof input === 'number') {
      if (currency === undefined)
        throw new ExpenseViolation('INVALID_INPUT', 'currency is required');
      return new ExpenseMoney(input, currency);
    }
    if (!input)
      throw new ExpenseViolation('INVALID_INPUT', 'Money is required');
    return new ExpenseMoney(input.amountMinor, input.currency);
  }

  get amountMinor(): number {
    return this.#amountMinor;
  }
  get currency(): Currency {
    return this.#currency;
  }
  toJSON(): MoneyInput {
    return { amountMinor: this.#amountMinor, currency: this.#currency };
  }
}

export abstract class ApprovalPolicy {
  abstract get name(): string;
  abstract requirementsFor(money: ExpenseMoney): ApprovalRequirements;

  canApprove(actor: ExpenseActor): boolean {
    return hasRole(actor, 'approver', 'finance', 'admin');
  }

  isSatisfied(
    requirements: ApprovalRequirements,
    approvals: readonly ApprovalRecord[],
  ): boolean {
    const people = new Set(approvals.map((approval) => approval.actorId));
    const finance = approvals.some((approval) =>
      approval.roles.some((role) => role === 'finance' || role === 'admin'),
    );
    const admin = approvals.some((approval) =>
      approval.roles.includes('admin'),
    );
    return (
      people.size >= requirements.quorum &&
      (!requirements.requiresFinance || finance) &&
      (!requirements.requiresAdmin || admin)
    );
  }
}

export class ThresholdApprovalPolicy extends ApprovalPolicy {
  override get name(): string {
    return 'demo-thresholds-v1';
  }

  override requirementsFor(money: ExpenseMoney): ApprovalRequirements {
    const { amountMinor } = money;
    return {
      policy: this.name,
      quorum: amountMinor <= 50_000 ? 1 : amountMinor <= 500_000 ? 2 : 3,
      requiresFinance: amountMinor > 50_000,
      requiresAdmin: amountMinor > 500_000,
    };
  }
}
