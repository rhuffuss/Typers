export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface PlanTaskInput {
  readonly id: string;
  readonly title?: string;
  readonly effortUnits: number;
  readonly dependencies?: readonly string[];
  readonly priority?: Priority;
  readonly maxDailyUnits?: number;
  readonly earliestStartDay?: number;
  /** Inclusive day offset: finishing on this day meets the deadline. */
  readonly deadlineDay?: number;
}

export interface PlanInput {
  readonly projectId: string;
  readonly startDate: string;
  readonly dailyCapacityUnits: number;
  readonly tasks: readonly PlanTaskInput[];
  readonly maxDays?: number;
  readonly costPerUnitCents?: number;
  readonly budgetCents?: number;
}

export type Success<T> = Readonly<{ ok: true; value: T }>;
export type Failure<E> = Readonly<{ ok: false; error: E }>;
export type Result<T, E> = Success<T> | Failure<E>;
export type ResultValue<R> = R extends Success<infer Value> ? Value : never;
export type ResultError<R> = R extends Failure<infer Error> ? Error : never;

export type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

interface PlanningErrorDetails {
  'invalid-input': { readonly path: string };
  'duplicate-task': { readonly taskId: string };
  'duplicate-dependency': {
    readonly taskId: string;
    readonly dependencyId: string;
  };
  'missing-dependency': {
    readonly taskId: string;
    readonly dependencyId: string;
  };
  'cyclic-dependency': { readonly cycle: readonly string[] };
  'capacity-exceeded': {
    readonly maxDays: number;
    readonly remainingEffortUnits: number;
    readonly unscheduledTaskIds: readonly string[];
  };
  cancelled: { readonly processedInputs: number };
}

export type PlanningErrorCode = keyof PlanningErrorDetails;
export type PlanningError = {
  [Code in PlanningErrorCode]: Readonly<
    { code: Code; message: string } & PlanningErrorDetails[Code]
  >;
}[PlanningErrorCode];
export type PlanningErrorFor<Code extends PlanningErrorCode> = Extract<
  PlanningError,
  { code: Code }
>;

export interface TaskAllocation {
  readonly taskId: string;
  readonly units: number;
}
export interface PlanDay {
  readonly day: number;
  readonly date: string;
  readonly usedUnits: number;
  readonly availableUnits: number;
  readonly allocations: readonly TaskAllocation[];
}
export interface PlannedTask {
  readonly id: string;
  readonly title: string;
  readonly priority: Priority;
  readonly dependencies: readonly string[];
  readonly effortUnits: number;
  readonly startDay: number;
  readonly endDay: number;
  readonly startDate: string;
  readonly finishDate: string;
  readonly deadlineDay?: number;
  readonly latenessDays: number;
}
export type PlanWarning =
  | Readonly<{
      code: 'deadline-missed';
      taskId: string;
      deadlineDay: number;
      endDay: number;
      latenessDays: number;
    }>
  | Readonly<{
      code: 'budget-exceeded';
      budgetCents: number;
      totalCostCents: number;
      excessCents: number;
    }>;
export interface DeliveryPlan {
  readonly projectId: string;
  readonly startDate: string;
  /** Null for an empty project; no fictitious workday is created. */
  readonly finishDate: string | null;
  readonly durationDays: number;
  readonly totalEffortUnits: number;
  readonly dailyCapacityUnits: number;
  readonly costPerUnitCents: number;
  readonly totalCostCents: number;
  readonly budgetCents?: number;
  readonly withinBudget: boolean | null;
  readonly tasks: readonly PlannedTask[];
  readonly days: readonly PlanDay[];
  readonly warnings: readonly PlanWarning[];
  readonly criticalPath: Readonly<{
    taskIds: readonly string[];
    /** Lower bound including releases, dependencies and each task's daily cap. */
    minimumDurationDays: number;
  }>;
}

export type AllocationKey = `day:${number}/task:${string}`;
export type AllocationReportRow = Readonly<
  TaskAllocation & { key: AllocationKey; day: number; date: string }
>;
export interface PlanBatch {
  readonly index: number;
  readonly items: readonly Readonly<{
    inputIndex: number;
    result: Result<DeliveryPlan, PlanningError>;
  }>[];
  readonly planned: number;
  readonly failed: number;
}
export interface BatchOptions {
  readonly batchSize?: number;
  readonly signal?: AbortSignal;
}

export function success<T>(value: T): Success<T> {
  return { ok: true, value };
}
export function failure<E extends PlanningError>(error: E): Failure<E> {
  return { ok: false, error };
}

export function selectFields<T extends object, Key extends keyof T>(
  value: T,
  keys: readonly Key[],
): Pick<T, Key> {
  const selected = {} as Pick<T, Key>;
  for (const key of keys) selected[key] = value[key];
  return selected;
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected planning variant: ${String(value)}`);
}

/** Exhaustive error classification shared by an HTTP adapter or a CLI. */
export function planningErrorStatus(
  error: PlanningError,
): 400 | 409 | 422 | 499 {
  switch (error.code) {
    case 'invalid-input':
      return 400;
    case 'duplicate-task':
    case 'duplicate-dependency':
      return 409;
    case 'missing-dependency':
    case 'cyclic-dependency':
    case 'capacity-exceeded':
      return 422;
    case 'cancelled':
      return 499;
    default:
      return assertNever(error);
  }
}
