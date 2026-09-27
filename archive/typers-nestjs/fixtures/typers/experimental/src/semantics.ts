import { None, Some as present, type Option } from '@typers/core';

/** The pattern Some is contextual; the imported constructor here has another name. */
export function inspect<T>(option: Option<T>): { matched: true; value: T } | { matched: false } {
  if let Some(value) = option {
    return { matched: true, value };
  } else {
    return { matched: false };
  }
}

export function evaluateOnce<T>(provider: () => Option<T>): T[] {
  const observed: T[] = [];
  if let Some(value) = provider() {
    observed.push(value);
  }
  return observed;
}

/** No @typers/core constructor participates when another producer uses the protocol. */
export function structural(option: { readonly kind: 'some'; readonly value: string } | { readonly kind: 'none' }): string {
  if let Some(value) = option {
    const narrowed: string = value;
    return narrowed.toUpperCase();
  } else {
    return 'ABSENT';
  }
}

const __typers_iflet_0 = 11;

export function hygieneAndShadowing(): number {
  const Some = 'ordinary local identifier';
  const value = 7;
  if let Some(value) = present(3) {
    if (Some !== 'ordinary local identifier') throw new Error('Pattern called the local variable');
    if let Some(nested) = present(value + __typers_iflet_0) {
      return nested + __typers_iflet_1 + outer();
    }
  }
  return value;
}

// A later declaration must also be protected from generated-name capture.
const __typers_iflet_1 = 13;
function outer(): number { return 7; }

export function knownVariants(): number {
  if let Some(value) = None {
    const impossible: never = value;
    return impossible;
  }
  if let Some(value) = present(9) {
    const number: number = value;
    return number;
  }
  return -1;
}

export async function asynchronous<T>(provider: () => Promise<Option<T>>): Promise<T | 'absent'> {
  if let Some(value) = await provider() {
    return value;
  } else {
    return 'absent';
  }
}

export function mutatePayload(): { count: number } {
  const payload = { count: 0 };
  if let Some(value) = present(payload) {
    // The binding is const, while an object payload keeps normal TS mutability.
    value.count += 1;
  }
  return payload;
}

export function controlFlow(): { total: number; finalized: number; early: number; receiver: number } {
  let total = 0;
  let finalized = 0;
  outer: for (let index = 0; index < 5; index++) {
    try {
      if let Some(value) = present(index) {
        if (value === 1) continue outer;
        if (value === 3) break outer;
        total += value;
      }
    } finally { finalized++; }
  }
  function earlyReturn(): number {
    try {
      if let Some(value) = present(8) { return value; }
      return -1;
    } finally { finalized++; }
  }
  const receiver = {
    amount: 5,
    calculate(input: number): number {
      if let Some(value) = present(input) {
        return this.amount + value + arguments.length;
      }
      return -1;
    },
  };
  const early = earlyReturn();
  return { total, finalized, early, receiver: receiver.calculate(2) };
}
