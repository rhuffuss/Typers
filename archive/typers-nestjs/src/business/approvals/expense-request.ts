import { randomUUID } from 'node:crypto';
import { ApprovalPolicy, ExpenseMoney } from './approval-policy.js';
import {
  ExpenseViolation,
  hasRole,
  requireActor,
  requireIdempotencyKey,
  requireText,
  requireVersion,
} from './contracts.js';
import type {
  CreateExpenseInput,
  ExpenseActor,
  ExpenseEvent,
  ExpenseSnapshot,
  ExpenseState,
  PaymentReceipt,
} from './contracts.js';

export abstract class VersionedAggregate {
  readonly #id: string;
  readonly #version: number;

  protected constructor(id: string, version: number) {
    this.#id = requireText(id, 'Expense id');
    requireVersion(version);
    this.#version = version;
  }

  get id(): string {
    return this.#id;
  }
  get version(): number {
    return this.#version;
  }
  abstract get label(): string;
  abstract toJSON(): unknown;
}

export type AnyExpenseRequest = {
  [State in ExpenseState]: ExpenseRequest<State>;
}[ExpenseState];

export class ExpenseRequest<
  State extends ExpenseState,
> extends VersionedAggregate {
  readonly #snapshot: ExpenseSnapshot<State>;

  private constructor(snapshot: ExpenseSnapshot<State>) {
    super(snapshot.id, snapshot.version);
    this.#snapshot = structuredClone(snapshot);
  }

  static create(
    input: CreateExpenseInput,
    actor: ExpenseActor,
  ): ExpenseRequest<'draft'> {
    requireActor(actor);
    if (!hasRole(actor, 'member', 'admin'))
      throw new ExpenseViolation(
        'FORBIDDEN',
        'Only members or administrators can request expenses',
      );
    if (!input)
      throw new ExpenseViolation('INVALID_INPUT', 'Expense input is required');
    const money = ExpenseMoney.of(input);
    const projectId = requireText(input.projectId, 'projectId');
    const title = requireText(input.title, 'title', 3, 160);
    const at = new Date().toISOString();
    return new ExpenseRequest({
      id: randomUUID(),
      projectId,
      requesterId: actor.id,
      title,
      ...money.toJSON(),
      state: 'draft',
      version: 1,
      requirements: null,
      approvals: [],
      rejection: null,
      payment: null,
      audit: [
        {
          type: 'expense.created',
          actorId: actor.id,
          version: 1,
          at,
          payload: { projectId, ...money.toJSON() },
        },
      ],
    });
  }

  get state(): State {
    return this.#snapshot.state;
  }
  get requesterId(): string {
    return this.#snapshot.requesterId;
  }
  override get label(): string {
    return `${this.#snapshot.title} (${this.state})`;
  }
  override toJSON(): ExpenseSnapshot<State> {
    return structuredClone(this.#snapshot);
  }

  submit(
    this: ExpenseRequest<'draft'>,
    actor: ExpenseActor,
    policy: ApprovalPolicy,
  ): ExpenseRequest<'submitted'> {
    this.requireState('draft');
    requireActor(actor);
    if (actor.id !== this.requesterId)
      throw new ExpenseViolation(
        'FORBIDDEN',
        'Only the requester can submit an expense',
      );
    const requirements = policy.requirementsFor(
      ExpenseMoney.of(this.#snapshot),
    );
    if (
      !Number.isSafeInteger(requirements.quorum) ||
      requirements.quorum < 1 ||
      typeof requirements.requiresFinance !== 'boolean' ||
      typeof requirements.requiresAdmin !== 'boolean'
    ) {
      throw new ExpenseViolation(
        'INVALID_INPUT',
        'Approval policy must require a positive integer quorum and explicit role requirements',
      );
    }
    return this.next(
      'submitted',
      { requirements },
      {
        type: 'expense.submitted',
        actorId: actor.id,
        at: new Date().toISOString(),
        version: this.version + 1,
        payload: { requirements },
      },
    );
  }

  approve(
    this: ExpenseRequest<'submitted'>,
    actor: ExpenseActor,
    policy: ApprovalPolicy,
  ): ExpenseRequest<'submitted'> | ExpenseRequest<'approved'> {
    this.requireState('submitted');
    this.requireReviewer(actor, policy);
    if (
      this.#snapshot.approvals.some((approval) => approval.actorId === actor.id)
    ) {
      throw new ExpenseViolation(
        'DUPLICATE_APPROVAL',
        'Each person can approve an expense once',
      );
    }
    const requirements = this.#snapshot.requirements;
    if (!requirements)
      throw new ExpenseViolation(
        'INVALID_TRANSITION',
        'Submitted expenses need approval requirements',
      );
    const at = new Date().toISOString();
    const roles = [...new Set(actor.roles)].sort();
    const approvals = [
      ...this.#snapshot.approvals,
      { actorId: actor.id, roles, at },
    ];
    const quorumReached = policy.isSatisfied(requirements, approvals);
    const event: ExpenseEvent<'approval.recorded'> = {
      type: 'approval.recorded',
      actorId: actor.id,
      at,
      version: this.version + 1,
      payload: { roles, quorumReached },
    };
    return quorumReached
      ? this.next('approved', { approvals }, event)
      : this.next('submitted', { approvals }, event);
  }

  reject(
    this: ExpenseRequest<'submitted'>,
    actor: ExpenseActor,
    reason: string,
    policy: ApprovalPolicy,
  ): ExpenseRequest<'rejected'> {
    this.requireState('submitted');
    this.requireReviewer(actor, policy);
    const explanation = requireText(reason, 'reason', 3, 500);
    const at = new Date().toISOString();
    return this.next(
      'rejected',
      { rejection: { actorId: actor.id, reason: explanation, at } },
      {
        type: 'expense.rejected',
        actorId: actor.id,
        at,
        version: this.version + 1,
        payload: { reason: explanation },
      },
    );
  }

  pay(
    this: ExpenseRequest<'approved'>,
    actor: ExpenseActor,
    idempotencyKey: string,
  ): ExpenseRequest<'paid'> {
    this.requireState('approved');
    requireActor(actor);
    if (!hasRole(actor, 'finance', 'admin'))
      throw new ExpenseViolation(
        'FORBIDDEN',
        'Only finance or administrators can pay expenses',
      );
    requireIdempotencyKey(idempotencyKey);
    const payment: PaymentReceipt = {
      paymentId: randomUUID(),
      idempotencyKey,
      actorId: actor.id,
      at: new Date().toISOString(),
    };
    return this.next(
      'paid',
      { payment },
      {
        type: 'expense.paid',
        actorId: actor.id,
        at: payment.at,
        version: this.version + 1,
        payload: { paymentId: payment.paymentId, idempotencyKey },
      },
    );
  }

  private requireState(expected: ExpenseState): void {
    if (this.state !== expected)
      throw new ExpenseViolation(
        'INVALID_TRANSITION',
        `Cannot perform this operation while expense is ${this.state}`,
      );
  }

  private requireReviewer(actor: ExpenseActor, policy: ApprovalPolicy): void {
    requireActor(actor);
    if (actor.id === this.requesterId)
      throw new ExpenseViolation(
        'FORBIDDEN',
        'Requesters cannot approve or reject their own expenses',
      );
    if (!policy.canApprove(actor))
      throw new ExpenseViolation(
        'FORBIDDEN',
        'An approver, finance or administrator role is required',
      );
  }

  private next<Next extends ExpenseState>(
    state: Next,
    changes: Partial<
      Pick<
        ExpenseSnapshot,
        'requirements' | 'approvals' | 'rejection' | 'payment'
      >
    >,
    event: ExpenseEvent,
  ): ExpenseRequest<Next> {
    return new ExpenseRequest({
      ...this.#snapshot,
      ...changes,
      state,
      version: this.version + 1,
      audit: [...this.#snapshot.audit, event],
    });
  }
}
