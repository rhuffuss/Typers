import { ContextIdFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  CreditAuthorizationService,
  CreditReviewService,
  CURRENCY_SYMBOL,
  ExpenseReceiptService,
  ProjectCreditClient,
  PurchaseReviewService,
  StrictReceiptService,
} from '../src/fundamentals-advanced/business.providers.js';
import type { AdvancedDiOptions } from '../src/fundamentals-advanced/fundamentals-advanced.module.js';
import { createAdvancedDiLab } from '../src/fundamentals-advanced/harness.js';
import { AllowedTenantContextStrategy } from '../src/fundamentals-advanced/tenant-context.js';

type Lab = Awaited<ReturnType<typeof createAdvancedDiLab>>;
interface Quote {
  tenantId: string;
  totalMinor: number;
  rateBookId: string;
  requestId: string;
  requestTag: string;
  contextFields: string[];
}

async function withLab(
  test: (lab: Lab, origin: string) => Promise<void>,
  options: AdvancedDiOptions = {},
) {
  const lab = await createAdvancedDiLab(options);
  try {
    await lab.app.listen(0, '127.0.0.1');
    await test(lab, await lab.app.getUrl());
  } finally {
    await lab.close();
    expect(lab.strategy.cachedTenants).toEqual([]);
  }
}

async function quote(
  origin: string,
  tenantId: string,
  requestTag = '',
  units = 2,
): Promise<Quote> {
  const response = await fetch(`${origin}/api/tenant-quotes?units=${units}`, {
    headers: { 'x-tenant-id': tenantId, 'x-demo-request-tag': requestTag },
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<Quote>;
}

describe('Advanced DI: durable tenant contexts over real HTTP', () => {
  it('shares a durable price book within one tenant while request identity stays fresh', async () => {
    await withLab(async (_lab, origin) => {
      const first = await quote(origin, 'acme', 'first-person');
      const second = await quote(origin, 'acme', 'second-person');
      expect(first).toMatchObject({
        tenantId: 'acme',
        totalMinor: 2500,
        requestTag: 'first-person',
        contextFields: ['tenantId'],
      });
      expect(second).toMatchObject({
        tenantId: 'acme',
        totalMinor: 2500,
        requestTag: 'second-person',
        contextFields: ['tenantId'],
      });
      expect(first.rateBookId).toBe(second.rateBookId);
      expect(first.requestId).not.toBe(second.requestId);
    });
  });

  it('isolates two tenants and converges simultaneous requests onto the correct durable instances', async () => {
    await withLab(async (lab, origin) => {
      const results = await Promise.all([
        quote(origin, 'acme', 'a1'),
        quote(origin, 'globex', 'g1'),
        quote(origin, 'acme', 'a2'),
        quote(origin, 'globex', 'g2'),
      ]);
      expect(results.map((result) => result.totalMinor)).toEqual([
        2500, 4000, 2500, 4000,
      ]);
      expect(results[0].rateBookId).toBe(results[2].rateBookId);
      expect(results[1].rateBookId).toBe(results[3].rateBookId);
      expect(results[0].rateBookId).not.toBe(results[1].rateBookId);
      expect(new Set(results.map((result) => result.requestId)).size).toBe(4);
      expect(results.map((result) => result.requestTag)).toEqual([
        'a1',
        'g1',
        'a2',
        'g2',
      ]);
      expect([...lab.strategy.cachedTenants].sort()).toEqual([
        'acme',
        'globex',
      ]);
    });
  });

  it('bounds the LRU cache and recreates an evicted tenant without inheriting another tenant price', async () => {
    await withLab(async (lab, origin) => {
      const oldAcme = await quote(origin, 'acme');
      const globex = await quote(origin, 'globex');
      await quote(origin, 'globex');
      const initech = await quote(origin, 'initech');
      expect(lab.strategy.cachedTenants).toEqual(['globex', 'initech']);
      expect(initech.totalMinor).toBe(3500);
      const newAcme = await quote(origin, 'acme');
      expect(newAcme.rateBookId).not.toBe(oldAcme.rateBookId);
      expect(newAcme.rateBookId).not.toBe(globex.rateBookId);
      expect(newAcme.totalMinor).toBe(oldAcme.totalMinor);
      expect(lab.strategy.cachedTenants).toEqual(['initech', 'acme']);
    });
  });

  it('rejects missing, unknown and ambiguous tenant headers without creating cached contexts', async () => {
    await withLab(async (lab, origin) => {
      for (const tenant of [
        undefined,
        'outsider',
        'acme, globex',
        '../../globex',
      ]) {
        const response = await fetch(`${origin}/api/tenant-quotes`, {
          headers: tenant === undefined ? {} : { 'x-tenant-id': tenant },
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
          message: 'An allowed x-tenant-id is required',
        });
      }
      expect(lab.strategy.cachedTenants).toEqual([]);
      for (const units of ['0', '1.5', '1001']) {
        const response = await fetch(
          `${origin}/api/tenant-quotes?units=${units}`,
          { headers: { 'x-tenant-id': 'acme' } },
        );
        expect(response.status).toBe(400);
        await response.body?.cancel();
      }
    });
  });

  it('clears context identities on close and resets the public context strategy', async () => {
    const lab = await createAdvancedDiLab();
    let oldId: string;
    try {
      await lab.app.listen(0, '127.0.0.1');
      oldId = (await quote(await lab.app.getUrl(), 'acme')).rateBookId;
      await expect(createAdvancedDiLab()).rejects.toThrow(
        'Only one advanced DI harness',
      );
    } finally {
      await lab.close();
    }
    expect(lab.strategy.cachedTenants).toEqual([]);
    await lab.close();
    expect(ContextIdFactory.getByRequest({ headers: {} })).toHaveProperty(
      'getParent',
      undefined,
    );
    await withLab(async (_nextLab, origin) => {
      expect((await quote(origin, 'acme')).rateBookId).not.toBe(oldId);
    });
  });

  it('validates capacity and releases strategy ownership after a failed configuration', async () => {
    expect(() => new AllowedTenantContextStrategy(0)).toThrow(
      'Context capacity',
    );
    expect(() => new AllowedTenantContextStrategy(4)).toThrow(
      'Context capacity',
    );
    await expect(
      createAdvancedDiLab({ reminderExtraDays: -1 }),
    ).rejects.toThrow('reminderExtraDays');
    await withLab(async (_lab, origin) => {
      expect((await quote(origin, 'globex')).totalMinor).toBe(4000);
    });
  });
});

describe('Advanced DI: consumer and optional dependencies', () => {
  it('injects each real INQUIRER consumer into its own transient audit provider', async () => {
    await withLab(async (lab, origin) => {
      const response = await fetch(`${origin}/api/di/audit`);
      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        purchase: { auditId: string };
        credit: { auditId: string };
      };
      expect(result).toMatchObject({
        purchase: {
          consumer: 'PurchaseReviewService',
          action: 'review-purchase',
          requiredRole: 'approver',
        },
        credit: {
          consumer: 'CreditReviewService',
          action: 'review-credit',
          requiredRole: 'finance',
        },
      });
      expect(result.purchase.auditId).not.toBe(result.credit.auditId);
      expect(lab.app.get(PurchaseReviewService).consumerTypeIsCorrect).toBe(
        true,
      );
      expect(lab.app.get(CreditReviewService).consumerTypeIsCorrect).toBe(true);
      expect(
        await fetch(`${origin}/api/di/audit`).then((value) => value.json()),
      ).toEqual(result);
    });
  });

  it('uses constructor/property/factory fallbacks and injects a required inherited property', async () => {
    await withLab(async (_lab, origin) => {
      const response = await fetch(`${origin}/api/di/receipt`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        reference: 'receipt-demo',
        amountMinor: 1500,
        currencySymbol: '€',
        footer: 'Local expense copy',
        followUpDays: 7,
      });
    });
  });

  it('uses supplied optional constructor/property/factory dependencies in the business result', async () => {
    await withLab(
      async (_lab, origin) => {
        const response = await fetch(`${origin}/api/di/receipt`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          reference: 'expense-demo',
          amountMinor: 1500,
          currencySymbol: '€',
          footer: 'Retain for review',
          followUpDays: 10,
        });
      },
      {
        receiptPrefix: 'expense',
        receiptFooter: 'Retain for review',
        reminderExtraDays: 3,
      },
    );
  });

  it('does not inherit constructor Optional metadata into a required derived dependency in Nest 12', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          StrictReceiptService,
          { provide: CURRENCY_SYMBOL, useValue: '€' },
        ],
      }).compile(),
    ).rejects.toThrow('RECEIPT_PREFIX');
  });

  it('fails to build when a required property dependency is absent', async () => {
    await expect(
      Test.createTestingModule({
        providers: [ExpenseReceiptService],
      }).compile(),
    ).rejects.toThrow('CURRENCY_SYMBOL');
  });

  it('runs the registered local credit adapter and rejects invalid amounts over HTTP', async () => {
    await withLab(async (_lab, origin) => {
      const allowed = await fetch(`${origin}/api/di/credit?amountMinor=10000`);
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toMatchObject({
        authorized: true,
        balanceMinor: 10000,
      });
      expect(
        await fetch(`${origin}/api/di/credit?amountMinor=10001`).then((value) =>
          value.json(),
        ),
      ).toMatchObject({ authorized: false });
      const invalid = await fetch(`${origin}/api/di/credit?amountMinor=-1`);
      expect(invalid.status).toBe(400);
      await invalid.body?.cancel();
    });
  });
});

describe('Advanced DI: Nest Testing useMocker and factory failures', () => {
  it('auto-mocks only the missing credit adapter and executes the real authorization service', async () => {
    const balanceFor = vi
      .fn<(projectId: string) => Promise<number>>()
      .mockResolvedValue(15_000);
    const moduleRef = await Test.createTestingModule({
      providers: [CreditAuthorizationService],
    })
      .useMocker((token) =>
        token === ProjectCreditClient ? { balanceFor } : undefined,
      )
      .compile();
    try {
      const service = moduleRef.get(CreditAuthorizationService);
      expect(await service.authorize('project-a', 15_000)).toMatchObject({
        authorized: true,
        balanceMinor: 15_000,
      });
      expect(await service.authorize('project-a', 15_001)).toMatchObject({
        authorized: false,
      });
      expect(balanceFor).toHaveBeenNthCalledWith(1, 'project-a');
      expect(moduleRef.get(ProjectCreditClient)).toEqual({ balanceFor });
      balanceFor.mockRejectedValueOnce(new Error('Credit adapter unavailable'));
      await expect(service.authorize('project-a', 5000)).rejects.toThrow(
        'Credit adapter unavailable',
      );
      balanceFor.mockResolvedValueOnce(-1);
      await expect(service.authorize('project-a', 5000)).rejects.toThrow(
        'invalid balance',
      );
    } finally {
      await moduleRef.close();
    }
  });

  it('propagates a required asynchronous factory failure without creating a usable module', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          {
            provide: 'REQUIRED_CREDIT_POLICY',
            useFactory: async () => {
              await Promise.resolve();
              throw new Error('Credit policy unavailable');
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow('Credit policy unavailable');
  });
});
