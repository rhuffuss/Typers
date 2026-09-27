import { compareId } from './input.js';
import type { ResolvedTask } from './input.js';
import { failure, success } from './types.js';
import type { DeliveryPlan, PlanningError, Result } from './types.js';

/** Graph state is private; traversals never consume or modify the caller's lists. */
export class DependencyGraph {
  readonly #tasks: ReadonlyMap<string, ResolvedTask>;
  readonly #dependents = new Map<string, string[]>();

  constructor(tasks: readonly ResolvedTask[]) {
    this.#tasks = new Map(tasks.map((task) => [task.id, task]));
    for (const task of tasks) this.#dependents.set(task.id, []);
    for (const task of tasks) {
      for (const dependency of task.dependencies)
        this.#dependents.get(dependency)!.push(task.id);
    }
    for (const ids of this.#dependents.values()) ids.sort(compareId);
  }

  *dependentsOf(taskId: string): Generator<string, void, void> {
    yield* this.#dependents.get(taskId) ?? [];
  }

  topologicalOrder(): Result<readonly ResolvedTask[], PlanningError> {
    const pending = new Map(
      [...this.#tasks].map(([id, task]) => [id, task.dependencies.length]),
    );
    const ready = [...pending]
      .filter(([, count]) => count === 0)
      .map(([id]) => id)
      .sort(compareId);
    const ordered: ResolvedTask[] = [];
    while (ready.length > 0) {
      const id = ready.shift()!;
      ordered.push(this.#tasks.get(id)!);
      for (const dependent of this.dependentsOf(id)) {
        const count = pending.get(dependent)! - 1;
        pending.set(dependent, count);
        if (count === 0) ready.push(dependent);
      }
      ready.sort(compareId);
    }
    if (ordered.length === this.#tasks.size) return success(ordered);
    const cycle = this.findCycle();
    return failure({
      code: 'cyclic-dependency',
      cycle,
      message: `Dependency cycle: ${cycle.join(' -> ')}`,
    });
  }

  /** Iterative DFS also produces a concrete closed cycle, rather than blocked descendants. */
  private findCycle(): readonly string[] {
    const colors = new Map<string, 'active' | 'finished'>();
    type Frame = { id: string; cursor: number };
    for (const root of [...this.#tasks.keys()].sort(compareId)) {
      if (colors.has(root)) continue;
      const stack: Frame[] = [{ id: root, cursor: 0 }];
      const positions = new Map([[root, 0]]);
      colors.set(root, 'active');
      while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        const dependencies = this.#tasks.get(frame.id)!.dependencies;
        if (frame.cursor === dependencies.length) {
          colors.set(frame.id, 'finished');
          positions.delete(frame.id);
          stack.pop();
          continue;
        }
        const dependency = dependencies[frame.cursor++];
        if (colors.get(dependency) === 'active') {
          return [
            ...stack.slice(positions.get(dependency)!).map(({ id }) => id),
            dependency,
          ];
        }
        if (!colors.has(dependency)) {
          colors.set(dependency, 'active');
          positions.set(dependency, stack.length);
          stack.push({ id: dependency, cursor: 0 });
        }
      }
    }
    throw new Error('A cyclic graph must contain a closed dependency path');
  }

  criticalPath(
    order: readonly ResolvedTask[],
    dailyCapacityUnits: number,
  ): DeliveryPlan['criticalPath'] {
    const finishes = new Map<string, number>();
    const predecessor = new Map<string, string>();
    let lastTask: string | undefined;
    let minimumDurationDays = 0;
    for (const task of order) {
      let earliest = task.earliestStartDay;
      for (const dependency of task.dependencies) {
        const finish = finishes.get(dependency)!;
        if (
          finish > earliest ||
          (finish === earliest && !predecessor.has(task.id))
        ) {
          earliest = finish;
          predecessor.set(task.id, dependency);
        }
      }
      const duration = Math.ceil(
        task.effortUnits / Math.min(dailyCapacityUnits, task.maxDailyUnits),
      );
      const finish = earliest + duration;
      finishes.set(task.id, finish);
      if (
        finish > minimumDurationDays ||
        (finish === minimumDurationDays &&
          (lastTask === undefined || compareId(task.id, lastTask) < 0))
      ) {
        minimumDurationDays = finish;
        lastTask = task.id;
      }
    }
    const reversed: string[] = [];
    while (lastTask !== undefined) {
      reversed.push(lastTask);
      lastTask = predecessor.get(lastTask);
    }
    return { taskIds: reversed.reverse(), minimumDurationDays };
  }
}
