import { beforeEach, describe, expect, it } from 'vitest';
import { ExpenseMoney, ThresholdApprovalPolicy } from './approval-policy.js';
import type {
  CreateExpenseInput,
  ExpenseActor,
  ExpenseResult,
  ExpenseSnapshot,
} from './contracts.js';
import { ExpenseViolation } from './contracts.js';
import { ExpenseRequest } from './expense-request.js';
import { InMemoryExpenseRepository } from './expense.repository.js';
import { ExpenseWorkflow } from './expense.workflow.js';

const requester = { id: 'requester', roles: ['member'] } satisfies ExpenseActor;
const approver = { id: 'approver', roles: ['approver'] } satisfies ExpenseActor;
const secondApprover = {
  id: 'second-approver',
  roles: ['approver'],
} satisfies ExpenseActor;
const finance = { id: 'finance', roles: ['finance'] } satisfies ExpenseActor;
const admin = { id: 'admin', roles: ['admin'] } satisfies ExpenseActor;
const reader = { id: 'reader', roles: ['reader'] } satisfies ExpenseActor;
const input = {
  projectId: 'project-a',
  title: 'Build server credits',
  amountMinor: 25_000,
  currency: 'EUR',
} satisfies CreateExpenseInput;

function unwrap<T>(result: ExpenseResult<T>): T {
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

describe('Expense aggregate: direct domain invariants and TypeScript runtime', () => {
  const policy = new ThresholdApprovalPolicy();

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid minor amount %s before a controller is involved',
    (amountMinor) => {
      expect(() => ExpenseMoney.of(amountMinor, 'EUR')).toThrow(
        ExpenseViolation,
      );
      expect(() =>
        ExpenseRequest.create({ ...input, amountMinor }, requester),
      ).toThrow(ExpenseViolation);
    },
  );

  it('accepts exact safe integers in either currency through both money overloads', () => {
    expect(ExpenseMoney.of(51_001, 'USD').toJSON()).toEqual({
      amountMinor: 51_001,
      currency: 'USD',
    });
    expect(
      ExpenseMoney.of({ amountMinor: Number.MAX_SAFE_INTEGER, currency: 'EUR' })
        .amountMinor,
    ).toBe(Number.MAX_SAFE_INTEGER);
    // @ts-expect-error Runtime callers can still supply an unsupported currency.
    expect(() => ExpenseMoney.of(100, 'GBP')).toThrow(ExpenseViolation);
  });

  it.each([
    [50_000, 1, false, false],
    [50_001, 2, true, false],
    [500_000, 2, true, false],
    [500_001, 3, true, true],
  ] as const)(
    'applies the boundary policy for %i minor units',
    (amountMinor, quorum, requiresFinance, requiresAdmin) => {
      expect(
        policy.requirementsFor(ExpenseMoney.of(amountMinor, 'EUR')),
      ).toEqual({
        policy: 'demo-thresholds-v1',
        quorum,
        requiresFinance,
        requiresAdmin,
      });
      expect(
        policy.requirementsFor(ExpenseMoney.of(amountMinor, 'USD')).quorum,
      ).toBe(quorum);
    },
  );

  it('keeps aggregate snapshots and old states isolated, and serializes no private fields', () => {
    const draft = ExpenseRequest.create(input, requester);
    const submitted = draft.submit(requester, policy);
    const approved = submitted.approve(approver, policy);
    expect(draft.state).toBe('draft');
    expect(draft.version).toBe(1);
    expect(submitted.state).toBe('submitted');
    expect(approved.state).toBe('approved');
    expect(approved.label).toBe('Build server credits (approved)');
    const snapshot = approved.toJSON();
    Reflect.set(snapshot, 'title', 'Outside mutation');
    Reflect.set(snapshot.approvals[0], 'actorId', 'outside');
    Reflect.set(snapshot.audit[0].payload, 'amountMinor', 1);
    expect(approved.toJSON().title).toBe(input.title);
    expect(approved.toJSON().approvals[0].actorId).toBe(approver.id);
    expect(approved.toJSON().audit[0].payload).toMatchObject({
      amountMinor: input.amountMinor,
    });
    expect(Object.keys(approved)).toEqual([]);
    expect(JSON.parse(JSON.stringify(approved))).toEqual(approved.toJSON());
    // @ts-expect-error Typestate rejects this call; the runtime guard also rejects it.
    expect(() => approved.submit(requester, policy)).toThrow(ExpenseViolation);
  });

  it('blocks self-review even when the requester has admin privileges', () => {
    const submitted = ExpenseRequest.create(input, admin).submit(admin, policy);
    expect(() => submitted.approve(admin, policy)).toThrow('own expenses');
    expect(() => submitted.reject(admin, 'No longer needed', policy)).toThrow(
      'own expenses',
    );
  });
});

describe('Expense workflow: persisted transitions, idempotency and concurrency', () => {
  let workflow: ExpenseWorkflow;

  beforeEach(() => {
    workflow = new ExpenseWorkflow(
      new InMemoryExpenseRepository(),
      new ThresholdApprovalPolicy(),
    );
  });

  async function createSubmitted(
    amountMinor = input.amountMinor,
  ): Promise<ExpenseSnapshot> {
    const draft = unwrap(
      await workflow.create({ ...input, amountMinor }, requester),
    );
    return unwrap(
      await workflow.submit(
        draft.id,
        { expectedVersion: draft.version },
        requester,
      ),
    );
  }

  async function createApproved(): Promise<ExpenseSnapshot> {
    const submitted = await createSubmitted();
    return unwrap(
      await workflow.approve(
        submitted.id,
        { expectedVersion: submitted.version },
        approver,
      ),
    );
  }

  it('performs draft → submitted → approved → paid with a typed audit and JSON-safe receipt', async () => {
    const approved = await createApproved();
    const paid = unwrap(
      await workflow.pay(
        approved.id,
        { expectedVersion: approved.version, idempotencyKey: 'payment-001' },
        finance,
      ),
    );
    expect(paid).toMatchObject({
      state: 'paid',
      version: 4,
      amountMinor: 25_000,
      currency: 'EUR',
      payment: { actorId: finance.id, idempotencyKey: 'payment-001' },
    });
    expect(paid.audit.map((event) => event.type)).toEqual([
      'expense.created',
      'expense.submitted',
      'approval.recorded',
      'expense.paid',
    ]);
    expect(paid.audit.map((event) => event.version)).toEqual([1, 2, 3, 4]);
    const last = paid.audit.at(-1);
    if (last?.type !== 'expense.paid')
      throw new Error('Expected payment event');
    expect(last.payload.paymentId).toBe(paid.payment?.paymentId);
    expect(JSON.parse(JSON.stringify(paid))).toEqual(paid);
    expect(unwrap(await workflow.get(paid.id))).toEqual(paid);
  });

  it('requires both quorum and finance approval for the middle tier', async () => {
    const submitted = await createSubmitted(50_001);
    const first = unwrap(
      await workflow.approve(
        submitted.id,
        { expectedVersion: submitted.version },
        approver,
      ),
    );
    const twoWithoutFinance = unwrap(
      await workflow.approve(
        first.id,
        { expectedVersion: first.version },
        secondApprover,
      ),
    );
    expect(twoWithoutFinance.state).toBe('submitted');
    expect(twoWithoutFinance.approvals).toHaveLength(2);
    const approved = unwrap(
      await workflow.approve(
        first.id,
        { expectedVersion: twoWithoutFinance.version },
        finance,
      ),
    );
    expect(approved.state).toBe('approved');
  });

  it('requires three distinct people including admin for the highest tier', async () => {
    const submitted = await createSubmitted(500_001);
    const first = unwrap(
      await workflow.approve(submitted.id, { expectedVersion: 2 }, approver),
    );
    const second = unwrap(
      await workflow.approve(first.id, { expectedVersion: 3 }, finance),
    );
    const thirdWithoutAdmin = unwrap(
      await workflow.approve(first.id, { expectedVersion: 4 }, secondApprover),
    );
    expect(second.state).toBe('submitted');
    expect(thirdWithoutAdmin.state).toBe('submitted');
    const approved = unwrap(
      await workflow.approve(first.id, { expectedVersion: 5 }, admin),
    );
    expect(approved.state).toBe('approved');
  });

  it('rejects duplicate approvals, missing reviewer roles and self-approval without changing audit/version', async () => {
    const submitted = await createSubmitted(50_001);
    expect(
      await workflow.approve(submitted.id, { expectedVersion: 2 }, requester),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await workflow.approve(submitted.id, { expectedVersion: 2 }, reader),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const first = unwrap(
      await workflow.approve(submitted.id, { expectedVersion: 2 }, approver),
    );
    expect(
      await workflow.approve(first.id, { expectedVersion: 3 }, approver),
    ).toMatchObject({ ok: false, error: { code: 'DUPLICATE_APPROVAL' } });
    expect(unwrap(await workflow.get(first.id))).toEqual(first);
  });

  it('stores a rejection reason and treats rejected/paid as terminal states', async () => {
    const submitted = await createSubmitted();
    expect(
      await workflow.reject(
        submitted.id,
        { expectedVersion: 2, reason: ' ' },
        admin,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    const rejected = unwrap(
      await workflow.reject(
        submitted.id,
        { expectedVersion: 2, reason: ' Duplicate purchase ' },
        admin,
      ),
    );
    expect(rejected).toMatchObject({
      state: 'rejected',
      version: 3,
      rejection: { reason: 'Duplicate purchase', actorId: admin.id },
    });
    expect(
      await workflow.approve(rejected.id, { expectedVersion: 3 }, approver),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(
      await workflow.submit(rejected.id, { expectedVersion: 3 }, requester),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(
      await workflow.pay(
        rejected.id,
        { expectedVersion: 3, idempotencyKey: 'reject-pay' },
        finance,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    const approved = await createApproved();
    const paid = unwrap(
      await workflow.pay(
        approved.id,
        { expectedVersion: 3, idempotencyKey: 'final-pay' },
        finance,
      ),
    );
    expect(
      await workflow.reject(
        paid.id,
        { expectedVersion: 4, reason: 'Too late' },
        admin,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(
      await workflow.pay(
        paid.id,
        { expectedVersion: 4, idempotencyKey: 'new-final-pay' },
        finance,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('protects ownership, valid inputs and optimistic versions at the application boundary', async () => {
    expect(await workflow.create(input, reader)).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(
      await workflow.create({ ...input, title: ' ' }, requester),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      await workflow.create({ ...input, projectId: '' }, requester),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    const draft = unwrap(await workflow.create(input, requester));
    expect(
      await workflow.submit(draft.id, { expectedVersion: 1 }, admin),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await workflow.submit(draft.id, { expectedVersion: 0 }, requester),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      await workflow.submit(draft.id, { expectedVersion: 2 }, requester),
    ).toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT' } });
    expect(
      await workflow.approve(draft.id, { expectedVersion: 1 }, approver),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(await workflow.get('absent')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(
      await workflow.submit('absent', { expectedVersion: 1 }, requester),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(unwrap(await workflow.get(draft.id))).toEqual(draft);
  });

  it('lets only one concurrent approval commit, and allows retrying the losing command with a fresh version', async () => {
    const submitted = await createSubmitted(50_001);
    const results = await Promise.all([
      workflow.approve(submitted.id, { expectedVersion: 2 }, approver),
      workflow.approve(submitted.id, { expectedVersion: 2 }, finance),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      {
        ok: false,
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Expected version 2; current version is 3',
        },
      },
    ]);
    const current = unwrap(await workflow.get(submitted.id));
    expect(current.approvals).toHaveLength(1);
    expect(current.audit).toHaveLength(3);
    const retryActor =
      current.approvals[0].actorId === approver.id ? finance : approver;
    expect(
      unwrap(
        await workflow.approve(
          current.id,
          { expectedVersion: current.version },
          retryActor,
        ),
      ).state,
    ).toBe('approved');
  });

  it('returns one receipt/event for simultaneous and later retries of the same payment command', async () => {
    const approved = await createApproved();
    const command = {
      expectedVersion: approved.version,
      idempotencyKey: 'same-payment-001',
    };
    const results = await Promise.all([
      workflow.pay(approved.id, command, finance),
      workflow.pay(approved.id, command, finance),
    ]);
    const paid = unwrap(results[0]);
    expect(unwrap(results[1])).toEqual(paid);
    expect(unwrap(await workflow.pay(approved.id, command, finance))).toEqual(
      paid,
    );
    expect(
      unwrap(await workflow.get(approved.id)).audit.filter(
        (event) => event.type === 'expense.paid',
      ),
    ).toHaveLength(1);
    expect(paid.version).toBe(4);
  });

  it('binds idempotency keys to expense, payer and original expected version, and enforces payer roles on retries', async () => {
    const approved = await createApproved();
    const command = { expectedVersion: 3, idempotencyKey: 'bound-payment' };
    expect(await workflow.pay(approved.id, command, approver)).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(
      await workflow.pay(
        approved.id,
        { ...command, idempotencyKey: 'short' },
        finance,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    unwrap(await workflow.pay(approved.id, command, finance));
    expect(
      await workflow.pay(approved.id, command, {
        id: finance.id,
        roles: ['reader'],
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await workflow.pay(approved.id, command, admin)).toMatchObject({
      ok: false,
      error: { code: 'IDEMPOTENCY_CONFLICT' },
    });
    expect(
      await workflow.pay(
        approved.id,
        { ...command, expectedVersion: 4 },
        finance,
      ),
    ).toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
    const another = await createApproved();
    expect(await workflow.pay(another.id, command, finance)).toMatchObject({
      ok: false,
      error: { code: 'IDEMPOTENCY_CONFLICT' },
    });
    expect(unwrap(await workflow.get(another.id)).state).toBe('approved');
  });

  it('replays a payment committed between the key lookup and the version lookup', async () => {
    let release = () => {};
    let entered = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      entered = resolve;
    });
    class DelayedReplayRepository extends InMemoryExpenseRepository {
      delayNext = true;
      override async replayPayment(key: string, fingerprint: string) {
        const result = await super.replayPayment(key, fingerprint);
        if (this.delayNext) {
          this.delayNext = false;
          entered();
          await gate;
        }
        return result;
      }
    }
    workflow = new ExpenseWorkflow(
      new DelayedReplayRepository(),
      new ThresholdApprovalPolicy(),
    );
    const approved = await createApproved();
    const command = {
      expectedVersion: 3,
      idempotencyKey: 'interleaved-payment',
    };
    const delayed = workflow.pay(approved.id, command, finance);
    try {
      await blocked;
      const committed = unwrap(
        await workflow.pay(approved.id, command, finance),
      );
      release();
      expect(unwrap(await delayed)).toEqual(committed);
      expect(
        committed.audit.filter((event) => event.type === 'expense.paid'),
      ).toHaveLength(1);
    } finally {
      release();
      await delayed;
    }
  });

  it('rejects the losing concurrent payment with a different key without reserving that key', async () => {
    const approved = await createApproved();
    const results = await Promise.all([
      workflow.pay(
        approved.id,
        { expectedVersion: 3, idempotencyKey: 'first-payment' },
        finance,
      ),
      workflow.pay(
        approved.id,
        { expectedVersion: 3, idempotencyKey: 'second-payment' },
        finance,
      ),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const failed = results.find((result) => !result.ok);
    expect(failed).toMatchObject({
      ok: false,
      error: { code: 'VERSION_CONFLICT' },
    });
    const paid = unwrap(await workflow.get(approved.id));
    expect(
      paid.audit.filter((event) => event.type === 'expense.paid'),
    ).toHaveLength(1);
    const unusedKey =
      paid.payment?.idempotencyKey === 'first-payment'
        ? 'second-payment'
        : 'first-payment';
    const another = await createApproved();
    expect(
      unwrap(
        await workflow.pay(
          another.id,
          { expectedVersion: 3, idempotencyKey: unusedKey },
          finance,
        ),
      ).state,
    ).toBe('paid');
  });
});
