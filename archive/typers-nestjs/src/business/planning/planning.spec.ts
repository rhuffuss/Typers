import { describe, expect, it } from 'vitest';
import {
  createPlan,
  iterateAllocations,
  parsePlanInput,
  planBatches,
  planningErrorStatus,
  selectTaskFields,
} from './index.js';
import type {
  DeliveryPlan,
  PlanInput,
  PlanTaskInput,
  PlanningError,
  Result,
} from './index.js';

const base = (
  tasks: readonly PlanTaskInput[],
  overrides: Partial<PlanInput> = {},
): PlanInput => ({
  projectId: 'demo-project',
  startDate: '2024-02-28',
  dailyCapacityUnits: 4,
  tasks,
  ...overrides,
});
function plan(input: PlanInput): DeliveryPlan {
  const result = createPlan(input);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
function errorOf<T>(result: Result<T, PlanningError>): PlanningError {
  if (result.ok) throw new Error('Expected a planning failure');
  return result.error;
}
function freezeInput(input: PlanInput): PlanInput {
  for (const task of input.tasks) {
    if (task.dependencies) Object.freeze(task.dependencies);
    Object.freeze(task);
  }
  Object.freeze(input.tasks);
  return Object.freeze(input);
}

async function collectAsync<Value>(
  source: AsyncIterable<Value>,
): Promise<Value[]> {
  const items: Value[] = [];
  for await (const item of source) items.push(item);
  return items;
}

/** Independent invariant checker, not a second copy of the scheduling algorithm. */
function verifyFeasible(input: PlanInput, delivery: DeliveryPlan) {
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const allocationsByTask = new Map<string, number>();
  for (const day of delivery.days) {
    const sum = day.allocations.reduce(
      (total, allocation) => total + allocation.units,
      0,
    );
    expect(day.usedUnits).toBe(sum);
    expect(day.usedUnits + day.availableUnits).toBe(input.dailyCapacityUnits);
    expect(sum).toBeLessThanOrEqual(input.dailyCapacityUnits);
    expect(new Set(day.allocations.map((item) => item.taskId)).size).toBe(
      day.allocations.length,
    );
    for (const allocation of day.allocations) {
      expect(Number.isSafeInteger(allocation.units)).toBe(true);
      expect(allocation.units).toBeGreaterThan(0);
      const task = taskById.get(allocation.taskId)!;
      expect(allocation.units).toBeLessThanOrEqual(
        task.maxDailyUnits ?? input.dailyCapacityUnits,
      );
      expect(day.day).toBeGreaterThanOrEqual(task.earliestStartDay ?? 0);
      for (const dependency of task.dependencies ?? []) {
        expect(day.day).toBeGreaterThan(
          delivery.tasks.find((candidate) => candidate.id === dependency)!
            .endDay,
        );
      }
      allocationsByTask.set(
        task.id,
        (allocationsByTask.get(task.id) ?? 0) + allocation.units,
      );
    }
  }
  for (const task of input.tasks)
    expect(allocationsByTask.get(task.id)).toBe(task.effortUnits);
  expect(delivery.totalEffortUnits).toBe(
    input.tasks.reduce((total, task) => total + task.effortUnits, 0),
  );
  expect(delivery.criticalPath.minimumDurationDays).toBeLessThanOrEqual(
    delivery.durationDays,
  );
}

describe('Dependency and capacity planning', () => {
  it('plans a diamond DAG, respects every dependency, and shares unused daily capacity', () => {
    const input = base([
      { id: 'design', effortUnits: 2, priority: 'high' },
      { id: 'api', effortUnits: 4, dependencies: ['design'], maxDailyUnits: 2 },
      { id: 'ui', effortUnits: 2, dependencies: ['design'] },
      { id: 'release', effortUnits: 1, dependencies: ['ui', 'api'] },
    ]);
    const delivery = plan(input);
    expect(delivery.days.map((day) => day.allocations)).toEqual([
      [{ taskId: 'design', units: 2 }],
      [
        { taskId: 'api', units: 2 },
        { taskId: 'ui', units: 2 },
      ],
      [{ taskId: 'api', units: 2 }],
      [{ taskId: 'release', units: 1 }],
    ]);
    expect(delivery.criticalPath).toEqual({
      taskIds: ['design', 'api', 'release'],
      minimumDurationDays: 4,
    });
    verifyFeasible(input, delivery);
  });

  it('is identical after reordering tasks and dependency arrays and never mutates frozen input', () => {
    const tasks = [
      { id: 'b', effortUnits: 3, priority: 'normal' as const },
      { id: 'a', effortUnits: 3, priority: 'normal' as const },
      { id: 'c', effortUnits: 1, dependencies: ['b', 'a'] },
    ];
    const input = freezeInput(base(tasks));
    const before = JSON.stringify(input);
    const reordered = base(
      [...tasks].reverse().map((task) => ({
        ...task,
        dependencies: task.dependencies ? [...task.dependencies].reverse() : [],
      })),
    );
    expect(plan(input)).toEqual(plan(reordered));
    expect(JSON.stringify(input)).toBe(before);
    expect(plan(input).days[0].allocations).toEqual([
      { taskId: 'a', units: 3 },
      { taskId: 'b', units: 1 },
    ]);
  });

  it('prioritizes newly released urgent work and permits splitting lower priority effort across days', () => {
    const input = base([
      { id: 'background', effortUnits: 7, priority: 'low' },
      {
        id: 'incident',
        effortUnits: 3,
        priority: 'critical',
        earliestStartDay: 1,
      },
    ]);
    const delivery = plan(input);
    expect(delivery.days.map((day) => day.allocations)).toEqual([
      [{ taskId: 'background', units: 4 }],
      [
        { taskId: 'incident', units: 3 },
        { taskId: 'background', units: 1 },
      ],
      [{ taskId: 'background', units: 2 }],
    ]);
    verifyFeasible(input, delivery);
  });

  it('emits idle days for release dates and uses UTC dates across leap day', () => {
    const input = base([
      { id: 'release', effortUnits: 2, earliestStartDay: 2 },
    ]);
    const delivery = plan(input);
    expect(
      delivery.days.map(({ date, usedUnits }) => ({ date, usedUnits })),
    ).toEqual([
      { date: '2024-02-28', usedUnits: 0 },
      { date: '2024-02-29', usedUnits: 0 },
      { date: '2024-03-01', usedUnits: 2 },
    ]);
    expect(delivery.tasks[0]).toMatchObject({
      startDay: 2,
      endDay: 2,
      startDate: '2024-03-01',
      finishDate: '2024-03-01',
    });
    verifyFeasible(input, delivery);
  });

  it('reports inclusive deadlines and integer-cent budget overruns without discarding a usable plan', () => {
    const delivery = plan(
      base(
        [
          { id: 'a', effortUnits: 4, deadlineDay: 0 },
          { id: 'b', effortUnits: 4, dependencies: ['a'], deadlineDay: 0 },
        ],
        { costPerUnitCents: 125, budgetCents: 900 },
      ),
    );
    expect(delivery.totalCostCents).toBe(1000);
    expect(delivery.withinBudget).toBe(false);
    expect(delivery.warnings).toEqual([
      {
        code: 'deadline-missed',
        taskId: 'b',
        deadlineDay: 0,
        endDay: 1,
        latenessDays: 1,
      },
      {
        code: 'budget-exceeded',
        budgetCents: 900,
        totalCostCents: 1000,
        excessCents: 100,
      },
    ]);
    expect(
      plan(
        base([{ id: 'a', effortUnits: 1 }], {
          costPerUnitCents: 100,
          budgetCents: 100,
        }),
      ).withinBudget,
    ).toBe(true);
  });

  it('returns an empty JSON-safe plan without inventing a finish date', () => {
    const delivery = plan(base([]));
    expect(delivery).toMatchObject({
      finishDate: null,
      durationDays: 0,
      totalEffortUnits: 0,
      totalCostCents: 0,
      withinBudget: null,
      tasks: [],
      days: [],
      warnings: [],
      criticalPath: { taskIds: [], minimumDurationDays: 0 },
    });
    expect(JSON.parse(JSON.stringify(delivery))).toEqual(delivery);
  });

  it('returns typed duplicate-task and duplicate-dependency failures', () => {
    const duplicate = errorOf(
      createPlan(
        base([
          { id: 'a', effortUnits: 1 },
          { id: 'a', effortUnits: 2 },
        ]),
      ),
    );
    expect(duplicate).toMatchObject({ code: 'duplicate-task', taskId: 'a' });
    expect(planningErrorStatus(duplicate)).toBe(409);
    expect(
      errorOf(
        createPlan(
          base([
            { id: 'a', effortUnits: 1 },
            { id: 'b', effortUnits: 1, dependencies: ['a', 'a'] },
          ]),
        ),
      ),
    ).toMatchObject({
      code: 'duplicate-dependency',
      taskId: 'b',
      dependencyId: 'a',
    });
  });

  it('reports the missing dependency and returns a closed cycle without including blocked descendants', () => {
    const missing = errorOf(
      createPlan(
        base([{ id: 'b', effortUnits: 1, dependencies: ['unknown'] }]),
      ),
    );
    expect(missing).toMatchObject({
      code: 'missing-dependency',
      taskId: 'b',
      dependencyId: 'unknown',
    });
    expect(planningErrorStatus(missing)).toBe(422);
    const cycle = errorOf(
      createPlan(
        base([
          { id: 'descendant', effortUnits: 1, dependencies: ['b'] },
          { id: 'b', effortUnits: 1, dependencies: ['c'] },
          { id: 'c', effortUnits: 1, dependencies: ['b'] },
        ]),
      ),
    );
    expect(cycle).toMatchObject({
      code: 'cyclic-dependency',
      cycle: ['b', 'c', 'b'],
    });
    expect(
      errorOf(
        createPlan(
          base([{ id: 'self', effortUnits: 1, dependencies: ['self'] }]),
        ),
      ),
    ).toMatchObject({ code: 'cyclic-dependency', cycle: ['self', 'self'] });
  });

  it('rejects impossible horizon capacity with remaining work, including partially completed tasks', () => {
    const failure = errorOf(
      createPlan(
        base(
          [
            { id: 'a', effortUnits: 5 },
            { id: 'b', effortUnits: 1 },
          ],
          { maxDays: 1 },
        ),
      ),
    );
    expect(failure).toMatchObject({
      code: 'capacity-exceeded',
      maxDays: 1,
      remainingEffortUnits: 2,
      unscheduledTaskIds: ['a', 'b'],
    });
    expect(
      errorOf(
        createPlan(
          base(
            [
              { id: 'a', effortUnits: 1 },
              { id: 'b', effortUnits: 1, dependencies: ['a'] },
            ],
            { maxDays: 1 },
          ),
        ),
      ),
    ).toMatchObject({
      code: 'capacity-exceeded',
      remainingEffortUnits: 1,
      unscheduledTaskIds: ['b'],
    });
  });

  it('provides a dependency lower bound while resource contention can make the actual plan longer', () => {
    const input = base([
      { id: 'a', effortUnits: 4 },
      { id: 'b', effortUnits: 4 },
    ]);
    const delivery = plan(input);
    expect(delivery.durationDays).toBe(2);
    expect(delivery.criticalPath).toEqual({
      taskIds: ['a'],
      minimumDurationDays: 1,
    });
    verifyFeasible(input, delivery);
  });

  it('checks independent feasibility invariants on a larger deterministic DAG', () => {
    const priorities = ['normal', 'low', 'high', 'critical'] as const;
    const tasks: PlanTaskInput[] = Array.from({ length: 120 }, (_, i) => ({
      id: `task-${String(i).padStart(3, '0')}`,
      effortUnits: (i % 7) + 1,
      maxDailyUnits: (i % 3) + 1,
      priority: priorities[i % priorities.length],
      dependencies:
        i > 3 ? [`task-${String(Math.floor(i / 3)).padStart(3, '0')}`] : [],
    }));
    const input = base(tasks, { dailyCapacityUnits: 12, maxDays: 365 });
    const delivery = plan(input);
    verifyFeasible(input, delivery);
    expect(
      plan(base([...tasks].reverse(), { dailyCapacityUnits: 12 })),
    ).toEqual(delivery);
  });
});

describe('Unknown planning input boundary', () => {
  it('rejects malformed dates, fractional effort, unsafe numbers and typo properties with paths', () => {
    const examples: [unknown, string][] = [
      [null, '$'],
      [[], '$'],
      [{ ...base([]), startDate: '2023-02-29' }, 'startDate'],
      [{ ...base([]), startDate: '2024-01-01T12:00Z' }, 'startDate'],
      [{ ...base([]), startDate: '9999-12-31', maxDays: 2 }, 'startDate'],
      [{ ...base([]), dailyCapacityUnits: 0 }, 'dailyCapacityUnits'],
      [{ ...base([]), dailyCapacityUnits: Number.NaN }, 'dailyCapacityUnits'],
      [{ ...base([]), costPerUnitCents: Infinity }, 'costPerUnitCents'],
      [
        { ...base([]), budgetCents: Number.MAX_SAFE_INTEGER + 1 },
        'budgetCents',
      ],
      [{ ...base([]), maxDays: null }, 'maxDays'],
      [{ ...base([]), accidental: true }, 'accidental'],
      [base([{ id: 'x', effortUnits: 1.5 }]), 'tasks[0].effortUnits'],
      [
        {
          ...base([]),
          tasks: [{ id: 'x', effortUnits: 1, dependencies: null }],
        },
        'tasks[0].dependencies',
      ],
      [
        {
          ...base([]),
          tasks: [{ id: 'x', effortUnits: 1, priority: 'urgent' }],
        },
        'tasks[0].priority',
      ],
      [
        { ...base([]), tasks: [{ id: 'x', effortUnits: 1, maxDailyUnits: 0 }] },
        'tasks[0].maxDailyUnits',
      ],
      [
        { ...base([]), tasks: [{ id: 'x', effortUnits: 1, estimte: 2 }] },
        'tasks[0].estimte',
      ],
    ];
    for (const [input, path] of examples) {
      const error = errorOf(parsePlanInput(input));
      expect(error).toMatchObject({ code: 'invalid-input', path });
      expect(error.message).toContain(path);
      expect(planningErrorStatus(error)).toBe(400);
    }
  });

  it('copies parsed task/dependency arrays and accepts supported defaults without changing caller data', () => {
    const input = base([
      { id: 'a', effortUnits: 1 },
      { id: 'b', effortUnits: 1, dependencies: ['a'] },
    ]);
    const parsed = parsePlanInput(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.tasks).not.toBe(input.tasks);
    expect(parsed.value.tasks[1].dependencies).not.toBe(
      input.tasks[1].dependencies,
    );
    expect(parsed.value.tasks[0]).toMatchObject({
      title: 'a',
      priority: 'normal',
      earliestStartDay: 0,
      maxDailyUnits: 4,
    });
    expect(createPlan(parsed.value).ok).toBe(true);
  });
});

describe('Iterable allocation reports and asynchronous planning batches', () => {
  it('iterates JSON-safe allocation rows and selects only requested typed task fields', () => {
    const delivery = plan(base([{ id: 'a', effortUnits: 5 }]));
    expect([...iterateAllocations(delivery)]).toEqual([
      {
        key: 'day:0/task:a',
        day: 0,
        date: '2024-02-28',
        taskId: 'a',
        units: 4,
      },
      {
        key: 'day:1/task:a',
        day: 1,
        date: '2024-02-29',
        taskId: 'a',
        units: 1,
      },
    ]);
    expect([...selectTaskFields(delivery, ['id', 'effortUnits'])]).toEqual([
      { id: 'a', effortUnits: 5 },
    ]);
  });

  it('batches synchronous inputs with stable indices and preserves individual planning failures', async () => {
    const inputs = [
      base([{ id: 'a', effortUnits: 1 }]),
      base([{ id: 'a', effortUnits: 1, dependencies: ['missing'] }]),
      base([]),
    ];
    const results = await collectAsync(planBatches(inputs, { batchSize: 2 }));
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      ok: true,
      value: {
        index: 0,
        planned: 1,
        failed: 1,
        items: [
          { inputIndex: 0, result: { ok: true } },
          {
            inputIndex: 1,
            result: { ok: false, error: { code: 'missing-dependency' } },
          },
        ],
      },
    });
    expect(results[1]).toMatchObject({
      ok: true,
      value: { index: 1, planned: 1, failed: 0, items: [{ inputIndex: 2 }] },
    });
    expect(JSON.parse(JSON.stringify(results))).toEqual(results);
  });

  it('honors backpressure and closes an asynchronous source after consumer cancellation', async () => {
    let pulled = 0;
    let closed = false;
    async function* source() {
      try {
        for (let i = 0; i < 5; i++) {
          pulled++;
          yield base([]);
        }
      } finally {
        closed = true;
      }
    }
    const batches = planBatches(source(), { batchSize: 2 });
    expect((await batches.next()).value).toMatchObject({
      ok: true,
      value: { planned: 2 },
    });
    expect(pulled).toBe(2);
    await batches.return();
    expect(closed).toBe(true);
    expect(pulled).toBe(2);
  });

  it('does not pull a pre-aborted source and returns a typed cancellation result', async () => {
    const controller = new AbortController();
    controller.abort();
    let pulled = 0;
    function* source() {
      pulled++;
      yield base([]);
    }
    const results = await collectAsync(
      planBatches(source(), { signal: controller.signal }),
    );
    expect(results).toEqual([
      {
        ok: false,
        error: {
          code: 'cancelled',
          processedInputs: 0,
          message: 'Planning cancelled after 0 input(s)',
        },
      },
    ]);
    expect(pulled).toBe(0);
    expect(
      planningErrorStatus(
        errorOf(createPlan(base([]), { signal: controller.signal })),
      ),
    ).toBe(499);
  });

  it('flushes completed work before an abort result and releases the source', async () => {
    const controller = new AbortController();
    let closed = false;
    async function* source() {
      try {
        yield base([]);
        controller.abort();
        yield base([]);
      } finally {
        closed = true;
      }
    }
    const results = await collectAsync(
      planBatches(source(), { batchSize: 10, signal: controller.signal }),
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      ok: true,
      value: { planned: 1, items: [{ inputIndex: 0 }] },
    });
    expect(results[1]).toMatchObject({
      ok: false,
      error: { code: 'cancelled', processedInputs: 1 },
    });
    expect(closed).toBe(true);
  });

  it('validates batch size before reading the source', async () => {
    let pulled = 0;
    function* source() {
      pulled++;
      yield base([]);
    }
    const results = await collectAsync(planBatches(source(), { batchSize: 0 }));
    expect(results).toMatchObject([
      { ok: false, error: { code: 'invalid-input', path: 'batchSize' } },
    ]);
    expect(pulled).toBe(0);
  });
});
