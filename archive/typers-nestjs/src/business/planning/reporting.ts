import { setImmediate } from 'node:timers/promises';
import { createPlan, cancelled } from './planner.js';
import { failure, selectFields, success } from './types.js';
import type {
  AllocationReportRow,
  BatchOptions,
  DeliveryPlan,
  PlanBatch,
  PlanInput,
  PlannedTask,
  PlanningError,
  Result,
} from './types.js';

export function* iterateAllocations(
  plan: DeliveryPlan,
): Generator<AllocationReportRow, void, void> {
  for (const day of plan.days) {
    for (const allocation of day.allocations) {
      yield {
        key: `day:${day.day}/task:${allocation.taskId}`,
        day: day.day,
        date: day.date,
        ...allocation,
      };
    }
  }
}

export function* selectTaskFields<Key extends keyof PlannedTask>(
  plan: DeliveryPlan,
  keys: readonly Key[],
): Generator<Pick<PlannedTask, Key>, void, void> {
  for (const task of plan.tasks) yield selectFields(task, keys);
}

/** Backpressure follows consumer next(); no source is read ahead of a completed batch. */
export async function* planBatches(
  inputs: Iterable<PlanInput> | AsyncIterable<PlanInput>,
  options: BatchOptions = {},
): AsyncGenerator<Result<PlanBatch, PlanningError>, void, void> {
  const batchSize = options.batchSize === undefined ? 10 : options.batchSize;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    yield failure({
      code: 'invalid-input',
      path: 'batchSize',
      message: 'batchSize: expected an integer between 1 and 1000',
    });
    return;
  }
  let processedInputs = 0;
  let batchIndex = 0;
  let items: PlanBatch['items'][number][] = [];
  const flush = (): PlanBatch => {
    const batch = {
      index: batchIndex++,
      items,
      planned: items.filter(({ result }) => result.ok).length,
      failed: items.filter(({ result }) => !result.ok).length,
    };
    items = [];
    return batch;
  };
  if (options.signal?.aborted) {
    yield cancelled(0);
    return;
  }
  for await (const input of inputs) {
    // Yield to the event loop so an AbortController/timer can interrupt long batches.
    await setImmediate();
    if (options.signal?.aborted) {
      if (items.length > 0) yield success(flush());
      yield cancelled(processedInputs);
      return;
    }
    items.push({ inputIndex: processedInputs++, result: createPlan(input) });
    if (items.length === batchSize) {
      yield success(flush());
      if (options.signal?.aborted) {
        yield cancelled(processedInputs);
        return;
      }
    }
  }
  if (items.length > 0) yield success(flush());
  if (options.signal?.aborted) yield cancelled(processedInputs);
}
