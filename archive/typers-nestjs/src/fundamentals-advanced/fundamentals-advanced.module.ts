import {
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  Module,
  ParseIntPipe,
  Query,
  Scope,
} from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
  BASE_REMINDER_DAYS,
  ConsumerAudit,
  CreditAuthorizationService,
  CreditReviewService,
  CURRENCY_SYMBOL,
  ExpenseReceiptService,
  LocalProjectCreditClient,
  ProjectCreditClient,
  PurchaseReviewService,
  RECEIPT_FOOTER,
  RECEIPT_PREFIX,
  REMINDER_EXTRA_DAYS,
  REMINDER_SCHEDULE,
  RequestAuditContext,
  TenantRateBook,
  TenantRatePolicyStore,
} from './business.providers.js';
import type { ReminderSchedule } from './business.providers.js';
import { allowedTenant, TENANT_PAYLOAD } from './tenant-context.js';
import type { TenantPayload } from './tenant-context.js';

@Controller({ path: 'tenant-quotes', scope: Scope.REQUEST, durable: false })
export class TenantQuotesController {
  constructor(
    private readonly rates: TenantRateBook,
    private readonly requestAudit: RequestAuditContext,
  ) {}

  @Get()
  quote(@Query('units', new DefaultValuePipe(1), ParseIntPipe) units: number) {
    return {
      ...this.rates.quote(units),
      requestId: this.requestAudit.instanceId,
      requestTag: this.requestAudit.tag,
    };
  }
}

@Controller('di')
export class AdvancedDiController {
  constructor(
    private readonly purchase: PurchaseReviewService,
    private readonly creditReview: CreditReviewService,
    private readonly receipts: ExpenseReceiptService,
    private readonly credit: CreditAuthorizationService,
    @Inject(REMINDER_SCHEDULE) private readonly reminder: ReminderSchedule,
  ) {}

  @Get('audit') audit() {
    return {
      purchase: this.purchase.review(),
      credit: this.creditReview.review(),
    };
  }
  @Get('receipt') receipt() {
    return { ...this.receipts.present(1500), ...this.reminder };
  }
  @Get('credit') creditCheck(
    @Query('amountMinor', new DefaultValuePipe(5000), ParseIntPipe)
    amountMinor: number,
  ) {
    return this.credit.authorize('demo-project', amountMinor);
  }
}

export interface AdvancedDiOptions {
  readonly receiptPrefix?: string;
  readonly receiptFooter?: string;
  readonly reminderExtraDays?: number;
}

@Module({})
export class FundamentalsAdvancedModule {
  static register(options: AdvancedDiOptions = {}): DynamicModule {
    const optional: Provider[] = [];
    if (options.receiptPrefix !== undefined)
      optional.push({
        provide: RECEIPT_PREFIX,
        useValue: options.receiptPrefix,
      });
    if (options.receiptFooter !== undefined)
      optional.push({
        provide: RECEIPT_FOOTER,
        useValue: options.receiptFooter,
      });
    if (options.reminderExtraDays !== undefined) {
      if (
        !Number.isInteger(options.reminderExtraDays) ||
        options.reminderExtraDays < 0 ||
        options.reminderExtraDays > 30
      )
        throw new Error('reminderExtraDays must be an integer from 0 to 30');
      optional.push({
        provide: REMINDER_EXTRA_DAYS,
        useValue: options.reminderExtraDays,
      });
    }
    return {
      module: FundamentalsAdvancedModule,
      controllers: [TenantQuotesController, AdvancedDiController],
      providers: [
        TenantRatePolicyStore,
        TenantRateBook,
        RequestAuditContext,
        ConsumerAudit,
        PurchaseReviewService,
        CreditReviewService,
        ExpenseReceiptService,
        CreditAuthorizationService,
        { provide: ProjectCreditClient, useClass: LocalProjectCreditClient },
        { provide: CURRENCY_SYMBOL, useValue: '€' },
        { provide: BASE_REMINDER_DAYS, useValue: 7 },
        {
          provide: REMINDER_SCHEDULE,
          inject: [
            BASE_REMINDER_DAYS,
            { token: REMINDER_EXTRA_DAYS, optional: true },
          ],
          useFactory: (base: number, extra?: number): ReminderSchedule =>
            Object.freeze({ followUpDays: base + (extra ?? 0) }),
        },
        {
          provide: TENANT_PAYLOAD,
          scope: Scope.REQUEST,
          durable: true,
          inject: [REQUEST],
          // Copy only the allowlisted identity, never retain the first request/user.
          useFactory: (request: TenantPayload): TenantPayload =>
            Object.freeze({ tenantId: allowedTenant(request.tenantId) }),
        },
        ...optional,
      ],
    };
  }
}
