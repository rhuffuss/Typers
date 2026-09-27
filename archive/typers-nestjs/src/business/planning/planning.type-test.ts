/** Compiler-only fixture: Vitest does not select *.type-test.ts; no call is made. */
import {
  createPlan,
  iterateAllocations,
  planBatches,
  selectTaskFields,
} from './index.js';
import type {
  AllocationKey,
  DeepReadonly,
  DeliveryPlan,
  PlanBatch,
  PlanInput,
  PlannedTask,
  PlanningError,
  PlanningErrorFor,
  Priority,
  Result,
  ResultError,
  ResultValue,
} from './index.js';

declare function expectType<Value>(value: Value): void;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Condition extends true> = Condition;
export type InferredPlan = Expect<
  Equal<ResultValue<ReturnType<typeof createPlan>>, DeliveryPlan>
>;
export type InferredFailure = Expect<
  Equal<ResultError<ReturnType<typeof createPlan>>, PlanningError>
>;
export type SpecificFailure = Expect<
  Equal<PlanningErrorFor<'missing-dependency'>['dependencyId'], string>
>;
export type PickedKeys = Expect<
  Equal<keyof Pick<PlannedTask, 'id' | 'startDay'>, 'id' | 'startDay'>
>;

// @ts-expect-error The code must belong to the mapped error-details union.
export type UnknownErrorVariant = PlanningErrorFor<'network-error'>;
// @ts-expect-error Readonly input arrays do not expose mutating array methods.
export type CannotPushTask = PlanInput['tasks']['push'];
// @ts-expect-error Value extraction is the actual plan, not a primitive.
export type IncorrectInference = Expect<false>;

export function planningTypeContracts(
  input: DeepReadonly<PlanInput>,
  delivery: DeliveryPlan,
  result: Result<DeliveryPlan, PlanningError>,
): void {
  expectType<Result<DeliveryPlan, PlanningError>>(createPlan(input));
  const selected = [...selectTaskFields(delivery, ['id', 'startDay'] as const)];
  expectType<Pick<PlannedTask, 'id' | 'startDay'>[]>(selected);
  // @ts-expect-error The selected projection does not contain effortUnits.
  void selected[0].effortUnits;
  // @ts-expect-error keyof rejects fields that are absent from PlannedTask.
  selectTaskFields(delivery, ['id', 'imaginary']);
  // @ts-expect-error Narrow the discriminated result before accessing value.
  void result.value;
  if (result.ok) {
    expectType<DeliveryPlan>(result.value);
    // @ts-expect-error A success has no error payload.
    void result.error;
  } else {
    expectType<PlanningError>(result.error);
    if (result.error.code === 'missing-dependency') {
      expectType<string>(result.error.dependencyId);
      // @ts-expect-error A missing reference is not a cyclic path.
      void result.error.cycle;
    }
  }
  // @ts-expect-error Nested readonly input cannot be changed by the engine.
  input.tasks[0].effortUnits = 8;
  // @ts-expect-error Priority is a finite union, not an arbitrary string.
  const invalidPriority: Priority = 'urgent';
  void invalidPriority;
  const key: AllocationKey = 'day:3/task:release';
  expectType<AllocationKey>(key);
  // @ts-expect-error Report keys use the day/task template-literal protocol.
  const malformedKey: AllocationKey = 'task:release/day:3';
  void malformedKey;
  for (const row of iterateAllocations(delivery))
    expectType<AllocationKey>(row.key);
  expectType<AsyncGenerator<Result<PlanBatch, PlanningError>, void, void>>(
    planBatches([input]),
  );
}
