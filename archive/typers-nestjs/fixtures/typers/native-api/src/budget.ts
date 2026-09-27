/** A small project-allocation rule queried and emitted by the native API. */
export const maximumBudget: number = 1200;

export type Allocation =
  | { kind: 'accepted'; remaining: number }
  | { kind: 'rejected'; reason: 'invalid-amount' | 'over-budget' };

export function allocateBudget(amount: number): Allocation {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { kind: 'rejected', reason: 'invalid-amount' };
  }
  if (amount > maximumBudget) {
    return { kind: 'rejected', reason: 'over-budget' };
  }
  return { kind: 'accepted', remaining: maximumBudget - amount };
}
