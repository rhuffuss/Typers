import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  Scope,
} from '@nestjs/common';
import { INQUIRER, REQUEST } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { TENANT_PAYLOAD } from './tenant-context.js';
import type { TenantId, TenantPayload } from './tenant-context.js';

export const RECEIPT_PREFIX = 'RECEIPT_PREFIX';
export const RECEIPT_FOOTER = 'RECEIPT_FOOTER';
export const CURRENCY_SYMBOL = 'CURRENCY_SYMBOL';
export const BASE_REMINDER_DAYS = 'BASE_REMINDER_DAYS';
export const REMINDER_EXTRA_DAYS = 'REMINDER_EXTRA_DAYS';
export const REMINDER_SCHEDULE = 'REMINDER_SCHEDULE';
export interface ReminderSchedule {
  readonly followUpDays: number;
}

@Injectable()
export class TenantRatePolicyStore {
  readonly #unitPrices: Readonly<Record<TenantId, number>> = Object.freeze({
    acme: 1250,
    globex: 2000,
    initech: 1750,
  });
  unitPrice(tenantId: TenantId): number {
    return this.#unitPrices[tenantId];
  }
}

@Injectable({ scope: Scope.REQUEST, durable: true })
export class TenantRateBook {
  readonly instanceId = randomUUID();
  readonly #unitPriceMinor: number;

  constructor(
    @Inject(TENANT_PAYLOAD) private readonly tenant: TenantPayload,
    policies: TenantRatePolicyStore,
  ) {
    this.#unitPriceMinor = policies.unitPrice(tenant.tenantId);
  }

  quote(units: number) {
    if (!Number.isSafeInteger(units) || units < 1 || units > 1000)
      throw new BadRequestException('units must be an integer from 1 to 1000');
    return {
      tenantId: this.tenant.tenantId,
      units,
      currency: 'EUR',
      unitPriceMinor: this.#unitPriceMinor,
      totalMinor: units * this.#unitPriceMinor,
      rateBookId: this.instanceId,
      contextFields: Object.keys(this.tenant),
    };
  }
}

@Injectable({ scope: Scope.REQUEST, durable: false })
export class RequestAuditContext {
  readonly instanceId = randomUUID();
  readonly tag: string;
  constructor(@Inject(REQUEST) request: Request) {
    const tag = request.headers['x-demo-request-tag'];
    this.tag = typeof tag === 'string' ? tag.slice(0, 64) : '';
  }
}

@Injectable({ scope: Scope.TRANSIENT })
export class ConsumerAudit {
  readonly instanceId = randomUUID();
  constructor(
    @Inject(INQUIRER) private readonly consumer: object | undefined,
  ) {}
  belongsToConsumerType(consumer: object): boolean {
    return consumer.constructor === this.consumer?.constructor;
  }
  record(action: string) {
    return {
      action,
      consumer: this.consumer?.constructor.name ?? 'unknown',
      auditId: this.instanceId,
    };
  }
}

@Injectable()
export class PurchaseReviewService {
  constructor(private readonly audit: ConsumerAudit) {}
  review() {
    return {
      requiredRole: 'approver',
      ...this.audit.record('review-purchase'),
    };
  }
  get consumerTypeIsCorrect(): boolean {
    return this.audit.belongsToConsumerType(this);
  }
}

@Injectable()
export class CreditReviewService {
  constructor(private readonly audit: ConsumerAudit) {}
  review() {
    return { requiredRole: 'finance', ...this.audit.record('review-credit') };
  }
  get consumerTypeIsCorrect(): boolean {
    return this.audit.belongsToConsumerType(this);
  }
}

export abstract class ReceiptPresenter {
  @Inject(CURRENCY_SYMBOL)
  protected readonly currencySymbol!: string;

  @Optional()
  @Inject(RECEIPT_FOOTER)
  protected readonly footer?: string;
}

@Injectable()
export class ExpenseReceiptService extends ReceiptPresenter {
  constructor(
    @Optional() @Inject(RECEIPT_PREFIX) private readonly prefix?: string,
  ) {
    super();
  }
  present(amountMinor: number) {
    return {
      reference: `${this.prefix ?? 'receipt'}-demo`,
      amountMinor,
      currencySymbol: this.currencySymbol,
      footer: this.footer ?? 'Local expense copy',
    };
  }
}

/** In Nest 12, an optional base constructor does not make this dependency optional. */
@Injectable()
export class StrictReceiptService extends ExpenseReceiptService {
  constructor(@Inject(RECEIPT_PREFIX) prefix: string) {
    super(prefix);
  }
}

export abstract class ProjectCreditClient {
  abstract balanceFor(projectId: string): Promise<number>;
}

@Injectable()
export class LocalProjectCreditClient extends ProjectCreditClient {
  override balanceFor(projectId: string): Promise<number> {
    return Promise.resolve(projectId === 'demo-project' ? 10_000 : 0);
  }
}

@Injectable()
export class CreditAuthorizationService {
  constructor(private readonly credit: ProjectCreditClient) {}

  async authorize(projectId: string, amountMinor: number) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
      throw new BadRequestException(
        'amountMinor must be a positive safe integer',
      );
    const balanceMinor = await this.credit.balanceFor(projectId);
    if (!Number.isSafeInteger(balanceMinor) || balanceMinor < 0)
      throw new Error('Credit provider returned an invalid balance');
    return {
      projectId,
      amountMinor,
      balanceMinor,
      authorized: balanceMinor >= amountMinor,
    };
  }
}
