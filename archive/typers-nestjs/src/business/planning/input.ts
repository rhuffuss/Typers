import { failure, success } from './types.js';
import type {
  PlanInput,
  PlanTaskInput,
  PlanningError,
  Priority,
  Result,
} from './types.js';

export interface ResolvedTask extends PlanTaskInput {
  readonly title: string;
  readonly dependencies: readonly string[];
  readonly priority: Priority;
  readonly maxDailyUnits: number;
  readonly earliestStartDay: number;
}
export interface ResolvedInput extends PlanInput {
  readonly tasks: readonly ResolvedTask[];
  readonly maxDays: number;
  readonly costPerUnitCents: number;
}
const DAY_MS = 86_400_000;
const MAX_DATE = Date.parse('9999-12-31T00:00:00.000Z');
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const topKeys = new Set([
  'projectId',
  'startDate',
  'dailyCapacityUnits',
  'tasks',
  'maxDays',
  'costPerUnitCents',
  'budgetCents',
]);
const taskKeys = new Set([
  'id',
  'title',
  'effortUnits',
  'dependencies',
  'priority',
  'maxDailyUnits',
  'earliestStartDay',
  'deadlineDay',
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function id(value: unknown): value is string {
  return typeof value === 'string' && identifier.test(value);
}
function priority(value: unknown): value is Priority {
  return (
    value === 'critical' ||
    value === 'high' ||
    value === 'normal' ||
    value === 'low'
  );
}
function invalid(path: string, message: string): Result<never, PlanningError> {
  return failure({
    code: 'invalid-input',
    path,
    message: `${path}: ${message}`,
  });
}
function extraKey(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): string | undefined {
  return Object.keys(value).find((key) => !allowed.has(key));
}

/** Validate at the JSON boundary and copy all arrays, including dependency lists. */
export function resolvePlanInput(
  value: unknown,
): Result<ResolvedInput, PlanningError> {
  if (!record(value)) return invalid('$', 'expected an object');
  const extra = extraKey(value, topKeys);
  if (extra !== undefined) return invalid(extra, 'unknown property');
  if (!id(value.projectId))
    return invalid(
      'projectId',
      'expected a 1–80 character identifier using letters, digits, dot, dash, underscore or colon',
    );
  if (
    typeof value.startDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.startDate) ||
    value.startDate.startsWith('0000')
  )
    return invalid('startDate', 'expected a real YYYY-MM-DD calendar date');
  const instant = Date.parse(`${value.startDate}T00:00:00.000Z`);
  if (
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 10) !== value.startDate
  )
    return invalid('startDate', 'expected a real YYYY-MM-DD calendar date');
  if (!integer(value.dailyCapacityUnits, 1, 1_000_000))
    return invalid(
      'dailyCapacityUnits',
      'expected an integer between 1 and 1000000',
    );
  const maxDays: unknown = value.maxDays === undefined ? 365 : value.maxDays;
  if (!integer(maxDays, 1, 3660))
    return invalid('maxDays', 'expected an integer between 1 and 3660');
  if (instant + (maxDays - 1) * DAY_MS > MAX_DATE)
    return invalid('startDate', 'the planning horizon exceeds year 9999');
  const costPerUnitCents: unknown =
    value.costPerUnitCents === undefined ? 0 : value.costPerUnitCents;
  if (!integer(costPerUnitCents, 0, 1_000_000))
    return invalid(
      'costPerUnitCents',
      'expected integer cents between 0 and 1000000',
    );
  if (
    value.budgetCents !== undefined &&
    !integer(value.budgetCents, 0, Number.MAX_SAFE_INTEGER)
  )
    return invalid('budgetCents', 'expected non-negative safe integer cents');
  if (!Array.isArray(value.tasks) || value.tasks.length > 1000)
    return invalid('tasks', 'expected an array containing at most 1000 tasks');
  const tasks: ResolvedTask[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.tasks.entries()) {
    const path = `tasks[${index}]`;
    if (!record(item)) return invalid(path, 'expected an object');
    const extra = extraKey(item, taskKeys);
    if (extra !== undefined)
      return invalid(`${path}.${extra}`, 'unknown property');
    if (!id(item.id))
      return invalid(`${path}.id`, 'expected a valid task identifier');
    if (ids.has(item.id))
      return failure({
        code: 'duplicate-task',
        taskId: item.id,
        message: `Task ${item.id} appears more than once`,
      });
    ids.add(item.id);
    if (
      item.title !== undefined &&
      (typeof item.title !== 'string' ||
        item.title.trim().length === 0 ||
        item.title.length > 200)
    )
      return invalid(
        `${path}.title`,
        'expected a non-empty title of at most 200 characters',
      );
    if (!integer(item.effortUnits, 1, 1_000_000))
      return invalid(
        `${path}.effortUnits`,
        'expected an integer between 1 and 1000000',
      );
    const taskPriority: unknown =
      item.priority === undefined ? 'normal' : item.priority;
    if (!priority(taskPriority))
      return invalid(
        `${path}.priority`,
        'expected critical, high, normal or low',
      );
    const maxDailyUnits: unknown =
      item.maxDailyUnits === undefined
        ? value.dailyCapacityUnits
        : item.maxDailyUnits;
    if (!integer(maxDailyUnits, 1, 1_000_000))
      return invalid(
        `${path}.maxDailyUnits`,
        'expected an integer between 1 and 1000000',
      );
    const earliestStartDay: unknown =
      item.earliestStartDay === undefined ? 0 : item.earliestStartDay;
    if (!integer(earliestStartDay, 0, 3659))
      return invalid(
        `${path}.earliestStartDay`,
        'expected an integer day offset between 0 and 3659',
      );
    if (item.deadlineDay !== undefined && !integer(item.deadlineDay, 0, 3659))
      return invalid(
        `${path}.deadlineDay`,
        'expected an integer day offset between 0 and 3659',
      );
    const dependencies: unknown =
      item.dependencies === undefined ? [] : item.dependencies;
    if (!Array.isArray(dependencies) || dependencies.length > 1000)
      return invalid(
        `${path}.dependencies`,
        'expected an array containing at most 1000 task identifiers',
      );
    const dependencyIds = new Set<string>();
    for (const dependency of dependencies) {
      if (!id(dependency))
        return invalid(
          `${path}.dependencies`,
          'expected valid task identifiers',
        );
      if (dependencyIds.has(dependency))
        return failure({
          code: 'duplicate-dependency',
          taskId: item.id,
          dependencyId: dependency,
          message: `Task ${item.id} repeats dependency ${dependency}`,
        });
      dependencyIds.add(dependency);
    }
    tasks.push({
      id: item.id,
      title: item.title ?? item.id,
      effortUnits: item.effortUnits,
      dependencies: [...dependencyIds].sort(),
      priority: taskPriority,
      maxDailyUnits,
      earliestStartDay,
      ...(item.deadlineDay !== undefined
        ? { deadlineDay: item.deadlineDay }
        : {}),
    });
  }
  tasks.sort((a, b) => compareId(a.id, b.id));
  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      if (!ids.has(dependencyId))
        return failure({
          code: 'missing-dependency',
          taskId: task.id,
          dependencyId,
          message: `Task ${task.id} depends on unknown task ${dependencyId}`,
        });
    }
  }
  return success({
    projectId: value.projectId,
    startDate: value.startDate,
    dailyCapacityUnits: value.dailyCapacityUnits,
    tasks,
    maxDays,
    costPerUnitCents,
    ...(value.budgetCents !== undefined
      ? { budgetCents: value.budgetCents }
      : {}),
  });
}
export function parsePlanInput(
  value: unknown,
): Result<PlanInput, PlanningError> {
  return resolvePlanInput(value);
}
export function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function calendarDate(startDate: string, day: number): string {
  return new Date(Date.parse(`${startDate}T00:00:00.000Z`) + day * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
