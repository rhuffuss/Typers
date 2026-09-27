import type { SchemaObject } from '@nestjs/swagger';
import type {
  Adjustment,
  Quote,
  QuoteLine,
  PricingErrorCode,
} from './pricing/index.js';
import type {
  DeliveryPlan,
  PlannedTask,
  PlanDay,
  PlanningErrorCode,
} from './planning/index.js';
import type {
  ApprovalRecord,
  ApprovalRequirements,
  ExpenseErrorCode,
  ExpenseEventPayloads,
  ExpenseSnapshot,
  PaymentReceipt,
} from './approvals/index.js';

// Inline schemas are self-contained: controllers need no component registration.
const object = (
  properties: Record<string, SchemaObject>,
  required: string[] = Object.keys(properties),
  description?: string,
): SchemaObject => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
  ...(description ? { description } : {}),
});
const array = (
  items: SchemaObject,
  options: Partial<SchemaObject> = {},
): SchemaObject => ({ type: 'array', items, ...options });
const integer = (
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): SchemaObject => ({ type: 'integer', minimum, maximum });
const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
});
const text: SchemaObject = { type: 'string' };
const boolean: SchemaObject = { type: 'boolean' };
const uuid: SchemaObject = { type: 'string', format: 'uuid' };
const date: SchemaObject = { type: 'string', format: 'date' };
const timestamp: SchemaObject = { type: 'string', format: 'date-time' };
const currency: SchemaObject = { type: 'string', enum: ['EUR', 'USD'] };
const identifier: SchemaObject = {
  type: 'string',
  pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$',
  maxLength: 80,
};
const roles: SchemaObject = array(
  {
    type: 'string',
    enum: ['admin', 'member', 'reader', 'approver', 'finance'],
  },
  { uniqueItems: true },
);
const minorString: SchemaObject = {
  type: 'string',
  pattern: '^(0|[1-9][0-9]*)$',
  maxLength: 12,
  description:
    'Exact nonnegative integer minor units, serialized as a string; "12000" means 120.00 in the quote currency. Maximum 999999999999. Never a floating-point amount.',
  example: '12000',
};
const expenseAmount: SchemaObject = {
  ...integer(1),
  description:
    'Positive safe-integer minor units in currency; 12000 means 120.00 EUR or USD. This expense API uses JSON integers, whereas quote amounts use strings.',
  example: 12000,
};
const planCost: SchemaObject = {
  ...integer(),
  description:
    'Nonnegative safe-integer demo cost units (cents). The planning model has no currency or exchange-rate conversion.',
};
const expenseVersion: SchemaObject = {
  ...integer(1),
  example: 3,
  description:
    'Optimistic-concurrency version. A draft starts at 1; each successful transition increments it. Send the latest value as expectedVersion. An exact payment retry reuses the original expectedVersion and idempotencyKey.',
};
const idempotencyKey: SchemaObject = {
  type: 'string',
  minLength: 8,
  maxLength: 128,
  pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$',
  description:
    'Caller-supplied key bound to the expense, authenticated payer and expectedVersion. Repeating the exact command returns the same simulated receipt.',
};

const quoteLineProperties = {
  sku: {
    type: 'string',
    enum: [
      'api-build',
      'security-audit',
      'support-seat',
      'onboarding-kit',
      'workshop',
    ],
  },
  name: text,
  category: { type: 'string', enum: ['service', 'subscription', 'physical'] },
  quantity: integer(1, 250),
  unitPriceMinor: minorString,
  subtotalMinor: minorString,
  discountMinor: minorString,
  netMinor: minorString,
  demoTaxBps: {
    ...integer(0, 10000),
    enum: [500, 1000, 2000],
    description:
      'Fictional tax rate in basis points: 500=5%, 1000=10%, 2000=20%. Not a legal tax calculation.',
  },
  taxMinor: minorString,
  totalMinor: minorString,
} satisfies Record<keyof QuoteLine, SchemaObject>;
const adjustmentProperties = {
  kind: { type: 'string', enum: ['plan', 'volume', 'coupon'] },
  label: {
    type: 'string',
    description: 'Plan id, coupon code or per-sku-volume-tiers.',
  },
  requestedMinor: minorString,
  discountMinor: minorString,
  capped: {
    type: 'boolean',
    description: 'True when the global discount cap reduced this policy.',
  },
} satisfies Record<keyof Adjustment, SchemaObject>;
const quoteTotalsProperties = {
  subtotalMinor: minorString,
  discountMinor: minorString,
  netMinor: minorString,
  serviceFeeMinor: minorString,
  shippingMinor: minorString,
  lineTaxMinor: minorString,
  serviceFeeTaxMinor: minorString,
  shippingTaxMinor: minorString,
  taxMinor: minorString,
  totalMinor: minorString,
} satisfies Record<keyof Quote['totals'], SchemaObject>;
const quoteProperties = {
  currency,
  plan: { type: 'string', enum: ['starter', 'team', 'enterprise'] },
  lines: array(object(quoteLineProperties), {
    minItems: 1,
    maxItems: 5,
    description: 'One line per SKU, ordered canonically by SKU.',
  }),
  adjustments: array(object(adjustmentProperties), {
    minItems: 2,
    maxItems: 3,
    description: 'Ordered plan, volume, then optional coupon discounts.',
  }),
  totals: object(quoteTotalsProperties),
  rulesApplied: array(text, {
    description:
      'Deterministic identifiers describing applied pricing, fee, shipping and rounding rules.',
  }),
} satisfies Record<keyof Quote, SchemaObject>;
export const quoteEnvelopeSchema: SchemaObject = object({
  projectId: uuid,
  quote: object(
    quoteProperties,
    undefined,
    'Calculated quotation only; no stock reservation, purchase or real tax assessment.',
  ),
});

const plannedTaskProperties = {
  id: identifier,
  title: { type: 'string', minLength: 1, maxLength: 200 },
  priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
  dependencies: array(identifier, { maxItems: 1000, uniqueItems: true }),
  effortUnits: integer(1, 1000000),
  startDay: integer(0, 3659),
  endDay: integer(0, 3659),
  startDate: date,
  finishDate: date,
  deadlineDay: {
    ...integer(0, 3659),
    description:
      'Optional inclusive deadline offset from the plan start date; finishing on this day is on time.',
  },
  latenessDays: integer(0, 3659),
} satisfies Record<keyof PlannedTask, SchemaObject>;
const planDayProperties = {
  day: integer(0, 3659),
  date,
  usedUnits: integer(0, 1000000),
  availableUnits: integer(0, 1000000),
  allocations: array(
    object({ taskId: identifier, units: integer(1, 1000000) }),
    { maxItems: 1000 },
  ),
} satisfies Record<keyof PlanDay, SchemaObject>;
const planWarning: SchemaObject = {
  description:
    'Warning code selects its corresponding detail shape. Warnings accompany successful plans.',
  oneOf: [
    object({
      code: { type: 'string', enum: ['deadline-missed'] },
      taskId: identifier,
      deadlineDay: integer(0, 3659),
      endDay: integer(0, 3659),
      latenessDays: integer(1, 3659),
    }),
    object({
      code: { type: 'string', enum: ['budget-exceeded'] },
      budgetCents: planCost,
      totalCostCents: planCost,
      excessCents: { ...planCost, minimum: 1 },
    }),
  ],
};
const deliveryPlanProperties = {
  projectId: uuid,
  startDate: date,
  finishDate: {
    ...nullable(date),
    description: 'Last simulated calendar day, or null for an empty plan.',
  },
  durationDays: integer(0, 3660),
  totalEffortUnits: integer(0, 1000000000),
  dailyCapacityUnits: integer(1, 1000000),
  costPerUnitCents: { ...planCost, maximum: 1000000 },
  totalCostCents: planCost,
  budgetCents: planCost,
  withinBudget: {
    ...nullable(boolean),
    description:
      'Null when no budget was supplied; otherwise indicates whether the total cost is within that budget.',
  },
  tasks: array(
    object(
      plannedTaskProperties,
      Object.keys(plannedTaskProperties).filter((key) => key !== 'deadlineDay'),
    ),
    { maxItems: 1000 },
  ),
  days: array(object(planDayProperties), {
    maxItems: 3660,
    description:
      'Consecutive simulated calendar days; this model does not exclude weekends or holidays.',
  }),
  warnings: array(planWarning),
  criticalPath: object({
    taskIds: array(identifier, { maxItems: 1000 }),
    minimumDurationDays: {
      ...integer(),
      description:
        'Lower bound considering dependencies, release days and per-task capacity; shared capacity may make the actual plan longer.',
    },
  }),
} satisfies Record<keyof DeliveryPlan, SchemaObject>;
export const deliveryPlanSchema: SchemaObject = object(
  deliveryPlanProperties,
  Object.keys(deliveryPlanProperties).filter((key) => key !== 'budgetCents'),
  'Successful delivery simulation. It does not modify the project tasks. Empty tasks produce zero duration and a null finish date.',
);

const requirementProperties = {
  policy: { type: 'string', example: 'demo-thresholds-v1' },
  quorum: integer(1),
  requiresFinance: boolean,
  requiresAdmin: boolean,
} satisfies Record<keyof ApprovalRequirements, SchemaObject>;
const requirements = object(requirementProperties);
const approvalProperties = {
  actorId: uuid,
  roles,
  at: timestamp,
} satisfies Record<keyof ApprovalRecord, SchemaObject>;
const paymentProperties = {
  paymentId: uuid,
  idempotencyKey,
  actorId: uuid,
  at: timestamp,
} satisfies Record<keyof PaymentReceipt, SchemaObject>;
const eventPayloads = {
  'expense.created': object({
    projectId: uuid,
    amountMinor: expenseAmount,
    currency,
  }),
  'expense.submitted': object({ requirements }),
  'approval.recorded': object({ roles, quorumReached: boolean }),
  'expense.rejected': object({
    reason: { type: 'string', minLength: 3, maxLength: 500 },
  }),
  'expense.paid': object({ paymentId: uuid, idempotencyKey }),
} satisfies Record<keyof ExpenseEventPayloads, SchemaObject>;
const expenseEvent: SchemaObject = {
  description:
    'Audit event discriminated by type; each branch specifies exactly the corresponding payload fields.',
  oneOf: Object.entries(eventPayloads).map(([type, payload]) =>
    object({
      type: { type: 'string', enum: [type] },
      actorId: uuid,
      version: expenseVersion,
      at: timestamp,
      payload,
    }),
  ),
};
const expenseSnapshotProperties = {
  id: uuid,
  projectId: uuid,
  requesterId: uuid,
  title: { type: 'string', minLength: 3, maxLength: 160 },
  amountMinor: expenseAmount,
  currency,
  state: {
    type: 'string',
    enum: ['draft', 'submitted', 'approved', 'rejected', 'paid'],
  },
  version: expenseVersion,
  requirements: {
    ...nullable(requirements),
    description:
      'Null in draft; the approval policy requirements are captured on submission.',
  },
  approvals: array(object(approvalProperties), {
    description:
      'Approval records from distinct reviewers. The requester cannot approve their own expense.',
  }),
  audit: array(expenseEvent, {
    minItems: 1,
    description:
      'Ordered audit history. Retrying an identical simulated payment does not append another event.',
  }),
  rejection: nullable(
    object({
      actorId: uuid,
      reason: { type: 'string', minLength: 3, maxLength: 500 },
      at: timestamp,
    }),
  ),
  payment: {
    ...nullable(object(paymentProperties)),
    description:
      'Null before payment. A paid expense contains a local simulated receipt; no financial transfer takes place.',
  },
} satisfies Record<keyof ExpenseSnapshot, SchemaObject>;
export const expenseSnapshotSchema: SchemaObject = object(
  expenseSnapshotProperties,
  undefined,
  'In-memory expense aggregate. State and version govern transitions; data and idempotency records are local to this process and disappear on restart.',
);

type BusinessErrorCode =
  PricingErrorCode | PlanningErrorCode | ExpenseErrorCode | 'PROJECT_ARCHIVED';
const domainErrorCodes = [
  'INVALID_MONEY',
  'MONEY_OVERFLOW',
  'NEGATIVE_MONEY',
  'CURRENCY_MISMATCH',
  'INVALID_RATIO',
  'INVALID_INPUT',
  'UNKNOWN_SKU',
  'INVALID_QUANTITY',
  'DUPLICATE_SKU',
  'OUT_OF_STOCK',
  'INVALID_COUPON',
  'COUPON_NOT_APPLICABLE',
  'COUPON_MINIMUM',
  'DELIVERY_NOT_APPLICABLE',
  'BUDGET_EXCEEDED',
  'NOT_FOUND',
  'FORBIDDEN',
  'INVALID_TRANSITION',
  'DUPLICATE_APPROVAL',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'PROJECT_ARCHIVED',
  'invalid-input',
  'duplicate-task',
  'duplicate-dependency',
  'missing-dependency',
  'cyclic-dependency',
  'capacity-exceeded',
  'cancelled',
] satisfies BusinessErrorCode[];
const domainErrorSchema = object(
  {
    code: { type: 'string', enum: domainErrorCodes },
    message: text,
    statusCode: {
      ...integer(400, 599),
      description:
        'HTTP status, present in domain-adapter errors. Some direct Nest domain exceptions omit it from the JSON body.',
    },
    path: {
      type: 'string',
      description:
        'Invalid input field, for example items[0].quantity or budgetMinor.',
    },
    details: {
      type: 'object',
      description:
        'Pricing-specific details such as available stock, coupon minimum or budget/required/excess minor-unit strings.',
      additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    },
    taskId: identifier,
    dependencyId: identifier,
    cycle: array(identifier, {
      description:
        'Cycle reported by planning when dependencies prevent a schedule.',
    }),
    maxDays: integer(1, 3660),
    remainingEffortUnits: integer(),
    unscheduledTaskIds: array(identifier),
    processedInputs: integer(),
  },
  ['code', 'message'],
  'Domain errors retain their typed pricing or planning details; these fields are not replaced with a generic message.',
);
const nestErrorSchema = object(
  {
    statusCode: integer(400, 599),
    message: { oneOf: [text, array(text)] },
    error: {
      type: 'string',
      description:
        'Optional Nest HTTP error label, such as Bad Request, Unauthorized or Forbidden.',
    },
  },
  ['statusCode', 'message'],
  'Standard Nest boundary errors, including DTO validation, malformed UUIDs, missing authentication and authorization failures.',
);
export const businessErrorSchema: SchemaObject = {
  description:
    'A detailed domain error or a standard Nest HTTP boundary error. The HTTP response status remains authoritative.',
  oneOf: [domainErrorSchema, nestErrorSchema],
};
