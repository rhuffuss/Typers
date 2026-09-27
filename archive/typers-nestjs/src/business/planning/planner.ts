import { DependencyGraph } from './dependency-graph.js';
import { calendarDate, compareId, resolvePlanInput } from './input.js';
import type { ResolvedInput, ResolvedTask } from './input.js';
import { failure, success } from './types.js';
import type {
  BatchOptions,
  DeliveryPlan,
  PlanDay,
  PlanInput,
  PlannedTask,
  PlanningError,
  PlanWarning,
  Priority,
  Result,
  TaskAllocation,
} from './types.js';

const priorityRank = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
} as const satisfies Record<Priority, number>;
interface Progress {
  remaining: number;
  startDay?: number;
  endDay?: number;
}

class CapacityPlanner {
  readonly #progress = new Map<string, Progress>();
  readonly #pendingDependencies = new Map<string, number>();
  readonly #days: PlanDay[] = [];
  #remainingTasks: number;

  constructor(
    private readonly input: ResolvedInput,
    private readonly graph: DependencyGraph,
  ) {
    this.#remainingTasks = input.tasks.length;
    for (const task of input.tasks) {
      this.#progress.set(task.id, { remaining: task.effortUnits });
      this.#pendingDependencies.set(task.id, task.dependencies.length);
    }
  }

  run(
    order: readonly ResolvedTask[],
    signal?: AbortSignal,
  ): Result<DeliveryPlan, PlanningError> {
    for (
      let day = 0;
      day < this.input.maxDays && this.#remainingTasks > 0;
      day++
    ) {
      if (signal?.aborted) return cancelled(0);
      const ready = this.input.tasks.filter(
        (task) =>
          this.#progress.get(task.id)!.remaining > 0 &&
          this.#pendingDependencies.get(task.id) === 0 &&
          task.earliestStartDay <= day,
      );
      ready.sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          compareId(a.id, b.id),
      );
      let available = this.input.dailyCapacityUnits;
      const allocations: TaskAllocation[] = [];
      const finishedToday: string[] = [];
      for (const task of ready) {
        if (available === 0) break;
        const progress = this.#progress.get(task.id)!;
        const units = Math.min(
          progress.remaining,
          task.maxDailyUnits,
          available,
        );
        progress.startDay ??= day;
        progress.remaining -= units;
        available -= units;
        allocations.push({ taskId: task.id, units });
        if (progress.remaining === 0) {
          progress.endDay = day;
          finishedToday.push(task.id);
          this.#remainingTasks--;
        }
      }
      // Dependencies completed today only become eligible on the next calendar day.
      for (const id of finishedToday) {
        for (const dependent of this.graph.dependentsOf(id)) {
          this.#pendingDependencies.set(
            dependent,
            this.#pendingDependencies.get(dependent)! - 1,
          );
        }
      }
      this.#days.push({
        day,
        date: calendarDate(this.input.startDate, day),
        usedUnits: this.input.dailyCapacityUnits - available,
        availableUnits: available,
        allocations,
      });
    }
    if (this.#remainingTasks > 0) {
      const unscheduled = this.input.tasks.filter(
        (task) => this.#progress.get(task.id)!.remaining > 0,
      );
      return failure({
        code: 'capacity-exceeded',
        maxDays: this.input.maxDays,
        remainingEffortUnits: unscheduled.reduce(
          (total, task) => total + this.#progress.get(task.id)!.remaining,
          0,
        ),
        unscheduledTaskIds: unscheduled.map((task) => task.id),
        message: `The deterministic priority schedule cannot finish ${unscheduled.length} task(s) within ${this.input.maxDays} days`,
      });
    }
    const warnings: PlanWarning[] = [];
    const tasks: PlannedTask[] = this.input.tasks.map((task) => {
      const progress = this.#progress.get(task.id)!;
      const startDay = progress.startDay!;
      const endDay = progress.endDay!;
      const latenessDays =
        task.deadlineDay === undefined
          ? 0
          : Math.max(0, endDay - task.deadlineDay);
      if (task.deadlineDay !== undefined && latenessDays > 0)
        warnings.push({
          code: 'deadline-missed',
          taskId: task.id,
          deadlineDay: task.deadlineDay,
          endDay,
          latenessDays,
        });
      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        dependencies: [...task.dependencies],
        effortUnits: task.effortUnits,
        startDay,
        endDay,
        startDate: calendarDate(this.input.startDate, startDay),
        finishDate: calendarDate(this.input.startDate, endDay),
        ...(task.deadlineDay !== undefined
          ? { deadlineDay: task.deadlineDay }
          : {}),
        latenessDays,
      };
    });
    const totalEffortUnits = tasks.reduce(
      (total, task) => total + task.effortUnits,
      0,
    );
    const totalCostCents = totalEffortUnits * this.input.costPerUnitCents;
    if (
      this.input.budgetCents !== undefined &&
      totalCostCents > this.input.budgetCents
    )
      warnings.push({
        code: 'budget-exceeded',
        budgetCents: this.input.budgetCents,
        totalCostCents,
        excessCents: totalCostCents - this.input.budgetCents,
      });
    return success({
      projectId: this.input.projectId,
      startDate: this.input.startDate,
      finishDate: this.#days.at(-1)?.date ?? null,
      durationDays: this.#days.length,
      totalEffortUnits,
      dailyCapacityUnits: this.input.dailyCapacityUnits,
      costPerUnitCents: this.input.costPerUnitCents,
      totalCostCents,
      ...(this.input.budgetCents !== undefined
        ? { budgetCents: this.input.budgetCents }
        : {}),
      withinBudget:
        this.input.budgetCents === undefined
          ? null
          : totalCostCents <= this.input.budgetCents,
      tasks,
      days: this.#days,
      warnings,
      criticalPath: this.graph.criticalPath(
        order,
        this.input.dailyCapacityUnits,
      ),
    });
  }
}

export function cancelled(
  processedInputs: number,
): Result<never, PlanningError> {
  return failure({
    code: 'cancelled',
    processedInputs,
    message: `Planning cancelled after ${processedInputs} input(s)`,
  });
}

/** The optional signal is execution context, never part of the JSON input. */
export function createPlan(
  input: PlanInput,
  options: Pick<BatchOptions, 'signal'> = {},
): Result<DeliveryPlan, PlanningError> {
  if (options.signal?.aborted) return cancelled(0);
  const parsed = resolvePlanInput(input);
  if (!parsed.ok) return parsed;
  const graph = new DependencyGraph(parsed.value.tasks);
  const order = graph.topologicalOrder();
  if (!order.ok) return order;
  return new CapacityPlanner(parsed.value, graph).run(
    order.value,
    options.signal,
  );
}
