import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { BusinessController } from './business.controller.js';
import { BusinessService } from './business.service.js';
import {
  ExpenseWorkflow,
  InMemoryExpenseRepository,
  ThresholdApprovalPolicy,
} from './approvals/index.js';

@Module({
  imports: [WorkspacesModule, SecurityModule],
  controllers: [BusinessController],
  providers: [
    BusinessService,
    {
      provide: ExpenseWorkflow,
      useFactory: () =>
        new ExpenseWorkflow(
          new InMemoryExpenseRepository(),
          new ThresholdApprovalPolicy(),
        ),
    },
  ],
  exports: [BusinessService],
})
export class BusinessModule {}
