export type Currency = 'EUR' | 'USD';
export type ExpenseState =
  'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

export interface ExpenseActor {
  readonly id: string;
  readonly roles: readonly string[];
}

export interface CreateExpenseInput {
  readonly projectId: string;
  readonly title: string;
  readonly amountMinor: number;
  readonly currency: Currency;
}

export interface VersionedExpenseInput {
  readonly expectedVersion: number;
}

export interface RejectExpenseInput extends VersionedExpenseInput {
  readonly reason: string;
}

export interface PayExpenseInput extends VersionedExpenseInput {
  readonly idempotencyKey: string;
}

export interface ApprovalRequirements {
  readonly policy: string;
  readonly quorum: number;
  readonly requiresFinance: boolean;
  readonly requiresAdmin: boolean;
}

export interface ApprovalRecord {
  readonly actorId: string;
  readonly roles: readonly string[];
  readonly at: string;
}

export interface PaymentReceipt {
  readonly paymentId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly at: string;
}

export interface ExpenseEventPayloads {
  'expense.created': {
    readonly projectId: string;
    readonly amountMinor: number;
    readonly currency: Currency;
  };
  'expense.submitted': { readonly requirements: ApprovalRequirements };
  'approval.recorded': {
    readonly roles: readonly string[];
    readonly quorumReached: boolean;
  };
  'expense.rejected': { readonly reason: string };
  'expense.paid': {
    readonly paymentId: string;
    readonly idempotencyKey: string;
  };
}

export type ExpenseEvent<
  K extends keyof ExpenseEventPayloads = keyof ExpenseEventPayloads,
> = {
  [Type in K]: {
    readonly type: Type;
    readonly actorId: string;
    readonly version: number;
    readonly at: string;
    readonly payload: ExpenseEventPayloads[Type];
  };
}[K];

export interface ExpenseSnapshot<S extends ExpenseState = ExpenseState> {
  readonly id: string;
  readonly projectId: string;
  readonly requesterId: string;
  readonly title: string;
  readonly amountMinor: number;
  readonly currency: Currency;
  readonly state: S;
  readonly version: number;
  readonly requirements: ApprovalRequirements | null;
  readonly approvals: readonly ApprovalRecord[];
  readonly audit: readonly ExpenseEvent[];
  readonly rejection: {
    readonly actorId: string;
    readonly reason: string;
    readonly at: string;
  } | null;
  readonly payment: PaymentReceipt | null;
}

export type ExpenseErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'FORBIDDEN'
  | 'DUPLICATE_APPROVAL'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT';

export interface ExpenseError {
  readonly code: ExpenseErrorCode;
  readonly message: string;
}

export type ExpenseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExpenseError };

export class ExpenseViolation extends Error {
  override readonly name = 'ExpenseViolation';

  constructor(
    readonly code: ExpenseErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function success<T>(value: T): ExpenseResult<T> {
  return { ok: true, value };
}

export function failure<T = never>(
  code: ExpenseErrorCode,
  message: string,
): ExpenseResult<T> {
  return { ok: false, error: { code, message } };
}

export function requireText(
  value: string,
  name: string,
  min = 1,
  max = 120,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw new ExpenseViolation(
      'INVALID_INPUT',
      `${name} must contain ${min} to ${max} characters`,
    );
  }
  return value.trim();
}

export function requireActor(actor: ExpenseActor): void {
  if (
    !actor ||
    requireText(actor.id, 'Actor id') !== actor.id ||
    !Array.isArray(actor.roles) ||
    !actor.roles.every((role) => typeof role === 'string')
  ) {
    throw new ExpenseViolation(
      'INVALID_INPUT',
      'Actor id and roles are required',
    );
  }
}

export function requireVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ExpenseViolation(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer',
    );
  }
}

export function requireIdempotencyKey(key: string): void {
  if (
    typeof key !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)
  ) {
    throw new ExpenseViolation(
      'INVALID_INPUT',
      'idempotencyKey must contain 8 to 128 letters, digits, dots, underscores, colons or hyphens',
    );
  }
}

export function hasRole(
  actor: ExpenseActor,
  ...roles: readonly string[]
): boolean {
  return roles.some((role) => actor.roles.includes(role));
}
