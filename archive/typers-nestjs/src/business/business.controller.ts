import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Auth, CurrentUser } from '../security/security.decorators.js';
import { Role } from '../security/role.enum.js';
import type { UserEntity } from '../security/user.entity.js';
import { BusinessService } from './business.service.js';
import {
  CreateExpenseDto,
  ExpenseVersionDto,
  PayExpenseDto,
  RejectExpenseDto,
} from './business.dto.js';
import { planSchema, quoteSchema } from './business.schemas.js';
import {
  quoteEnvelopeSchema,
  deliveryPlanSchema,
  expenseSnapshotSchema,
  businessErrorSchema,
} from './business-response.schemas.js';

@ApiTags('business')
@ApiBadRequestResponse({ schema: businessErrorSchema })
@ApiConflictResponse({ schema: businessErrorSchema })
@ApiUnprocessableEntityResponse({ schema: businessErrorSchema })
@Auth()
@Controller('projects/:projectId/business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Post('quotes')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Calculate a project quote with deterministic discounts, fees and demo taxes',
  })
  @ApiBody({ schema: quoteSchema })
  @ApiOkResponse({ schema: quoteEnvelopeSchema })
  quote(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() input: unknown,
  ) {
    return this.business.quote(projectId, input);
  }

  @Post('plans')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Simulate a delivery plan with dependencies, capacity, costs and deadlines',
  })
  @ApiBody({ schema: planSchema })
  @ApiOkResponse({ schema: deliveryPlanSchema })
  plan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() input: unknown,
  ) {
    return this.business.plan(projectId, input);
  }

  @Post('expenses')
  @ApiCreatedResponse({ schema: expenseSnapshotSchema })
  @Auth(Role.Member, Role.Admin)
  @ApiOperation({
    summary: 'Draft an expense request; separate reviewers must approve it',
  })
  createExpense(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() input: CreateExpenseDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.business.createExpense(projectId, input, user);
  }

  @Get('expenses/:expenseId')
  @ApiOkResponse({ schema: expenseSnapshotSchema })
  getExpense(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.business.getExpense(projectId, expenseId, user);
  }

  @Post('expenses/:expenseId/submit')
  @ApiOkResponse({ schema: expenseSnapshotSchema })
  @HttpCode(200)
  @Auth(Role.Member, Role.Admin)
  submit(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() input: ExpenseVersionDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.business.changeExpense(
      projectId,
      expenseId,
      { kind: 'submit', input },
      user,
    );
  }

  @Post('expenses/:expenseId/approve')
  @ApiOkResponse({ schema: expenseSnapshotSchema })
  @HttpCode(200)
  @Auth(Role.Approver, Role.Finance, Role.Admin)
  approve(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() input: ExpenseVersionDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.business.changeExpense(
      projectId,
      expenseId,
      { kind: 'approve', input },
      user,
    );
  }

  @Post('expenses/:expenseId/reject')
  @ApiOkResponse({ schema: expenseSnapshotSchema })
  @HttpCode(200)
  @Auth(Role.Approver, Role.Finance, Role.Admin)
  reject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() input: RejectExpenseDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.business.changeExpense(
      projectId,
      expenseId,
      { kind: 'reject', input },
      user,
    );
  }

  @Post('expenses/:expenseId/pay')
  @ApiOkResponse({ schema: expenseSnapshotSchema })
  @HttpCode(200)
  @Auth(Role.Finance, Role.Admin)
  pay(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() input: PayExpenseDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.business.changeExpense(
      projectId,
      expenseId,
      { kind: 'pay', input },
      user,
    );
  }
}
