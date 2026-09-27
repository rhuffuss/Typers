import type { SchemaObject } from '@nestjs/swagger';

export const quoteSchema = {
  type: 'object',
  required: ['currency', 'items'],
  additionalProperties: false,
  properties: {
    currency: { type: 'string', enum: ['EUR', 'USD'] },
    plan: { type: 'string', enum: ['starter', 'team', 'enterprise'] },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['sku', 'quantity'],
        additionalProperties: false,
        properties: {
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
          quantity: {
            type: 'integer',
            minimum: 1,
            maximum: 250,
            description:
              'Each SKU also imposes its own quantity and stock limits.',
          },
        },
      },
    },
    coupon: { type: 'string', enum: ['WELCOME10', 'TEAM20', 'SAVE2500'] },
    delivery: { type: 'string', enum: ['standard', 'express'] },
    budgetMinor: {
      type: 'string',
      pattern: '^(0|[1-9][0-9]*)$',
      maxLength: 12,
      description:
        'Integer minor units as a string, preserving BigInt precision.',
    },
  },
  example: {
    currency: 'EUR',
    plan: 'team',
    items: [{ sku: 'api-build', quantity: 12 }],
    coupon: 'WELCOME10',
  },
} satisfies SchemaObject;

export const planSchema = {
  type: 'object',
  required: ['startDate', 'dailyCapacityUnits', 'tasks'],
  additionalProperties: false,
  properties: {
    startDate: { type: 'string', format: 'date' },
    dailyCapacityUnits: { type: 'integer', minimum: 1, maximum: 1000000 },
    maxDays: { type: 'integer', minimum: 1, maximum: 3660 },
    costPerUnitCents: { type: 'integer', minimum: 0, maximum: 1000000 },
    budgetCents: {
      type: 'integer',
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    },
    tasks: {
      type: 'array',
      maxItems: 1000,
      items: {
        type: 'object',
        required: ['id', 'effortUnits'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          effortUnits: { type: 'integer', minimum: 1, maximum: 1000000 },
          dependencies: {
            type: 'array',
            maxItems: 1000,
            items: {
              type: 'string',
              pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$',
            },
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'normal', 'low'],
          },
          maxDailyUnits: { type: 'integer', minimum: 1, maximum: 1000000 },
          earliestStartDay: { type: 'integer', minimum: 0, maximum: 3659 },
          deadlineDay: { type: 'integer', minimum: 0, maximum: 3659 },
        },
      },
    },
  },
  example: {
    startDate: '2026-09-15',
    dailyCapacityUnits: 8,
    tasks: [
      { id: 'design', effortUnits: 8, priority: 'high' },
      { id: 'implementation', effortUnits: 16, dependencies: ['design'] },
      {
        id: 'review',
        effortUnits: 4,
        dependencies: ['implementation'],
        deadlineDay: 4,
      },
    ],
  },
} satisfies SchemaObject;
