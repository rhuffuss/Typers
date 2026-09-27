import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { ProjectStatus } from '../workspaces/workspaces.dto.js';
import { Role } from '../security/role.enum.js';
import { ExpenseWorkflow } from './approvals/index.js';
import { quoteUnknown } from './pricing/index.js';
import {
  createPlan,
  parsePlanInput,
  planningErrorStatus,
} from './planning/index.js';
import {
  assertUnreachable,
  requireSuccess,
  type SuccessOf,
} from './business-errors.js';
import type { CreateExpenseDto } from './business.dto.js';

type ExpenseActor = Parameters<ExpenseWorkflow['create']>[1];
type ExpenseSnapshot = SuccessOf<Awaited<ReturnType<ExpenseWorkflow['get']>>>;
type ExpenseAction = 'submit' | 'approve' | 'reject' | 'pay';
// A mapped union preserves the correlation between each command and its payload.
export type ExpenseCommand = {
  [K in ExpenseAction]: {
    readonly kind: K;
    readonly input: Parameters<ExpenseWorkflow[K]>[1];
  };
}[ExpenseAction];

@Injectable()
export class BusinessService {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly expenses: ExpenseWorkflow,
  ) {}

  private async activeProject(projectId: string) {
    const project = await this.workspaces.getProject(projectId);
    if (project.status === ProjectStatus.Archived) {
      throw new ConflictException({
        code: 'PROJECT_ARCHIVED',
        message: 'Archived projects cannot start or change business workflows.',
      });
    }
    return project;
  }

  async quote(projectId: string, input: unknown) {
    await this.activeProject(projectId);
    return { projectId, quote: requireSuccess(quoteUnknown(input)) };
  }

  async plan(projectId: string, input: unknown) {
    await this.activeProject(projectId);
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'Plan input must be an object.',
      });
    }
    if ('projectId' in input) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        path: 'projectId',
        message: 'The project is selected by the route, not by the plan body.',
      });
    }
    // The authenticated route fixes the project; the request cannot select another one.
    const planInput = requireSuccess(
      parsePlanInput({ ...input, projectId }),
      planningErrorStatus,
    );
    return requireSuccess(createPlan(planInput), planningErrorStatus);
  }

  async createExpense(
    projectId: string,
    input: CreateExpenseDto,
    actor: ExpenseActor,
  ) {
    await this.activeProject(projectId);
    return requireSuccess(
      await this.expenses.create(
        {
          projectId,
          title: input.title,
          amountMinor: input.amountMinor,
          currency: input.currency,
        },
        actor,
      ),
    );
  }

  private async scopedExpense(
    projectId: string,
    expenseId: string,
  ): Promise<ExpenseSnapshot> {
    await this.workspaces.getProject(projectId);
    const expense = requireSuccess(await this.expenses.get(expenseId));
    if (expense.projectId !== projectId)
      throw new NotFoundException('Expense not found in this project.');
    return expense;
  }

  async getExpense(projectId: string, expenseId: string, actor: ExpenseActor) {
    const expense = await this.scopedExpense(projectId, expenseId);
    const canReview = actor.roles.some((role) =>
      [Role.Admin, Role.Approver, Role.Finance].some(
        (allowed) => allowed === role,
      ),
    );
    if (actor.id !== expense.requesterId && !canReview)
      throw new ForbiddenException(
        'Only the requester and reviewers can read an expense.',
      );
    return expense;
  }

  async changeExpense(
    projectId: string,
    expenseId: string,
    command: ExpenseCommand,
    actor: ExpenseActor,
  ) {
    await this.activeProject(projectId);
    await this.scopedExpense(projectId, expenseId);
    // A discriminated union narrows the payload as the business action changes.
    switch (command.kind) {
      case 'submit':
        return requireSuccess(
          await this.expenses.submit(expenseId, command.input, actor),
        );
      case 'approve':
        return requireSuccess(
          await this.expenses.approve(expenseId, command.input, actor),
        );
      case 'reject':
        return requireSuccess(
          await this.expenses.reject(expenseId, command.input, actor),
        );
      case 'pay':
        return requireSuccess(
          await this.expenses.pay(expenseId, command.input, actor),
        );
      default:
        return assertUnreachable(command);
    }
  }
}
