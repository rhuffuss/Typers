import { Some, type Option } from '@typers/core';

/** Compilation proves each negative assertion; this function is never invoked. */
export function typeContracts(option: Option<number>): void {
  if let Some(value) = option {
    const number: number = value;
    // @ts-expect-error The binding is equivalent to const.
    value = 2;
    // @ts-expect-error Payload inference preserves number, not string.
    const text: string = value;
    void [number, text];
  } else {
    // @ts-expect-error The binding exists only in the matched block.
    value;
  }
  // @ts-expect-error The binding cannot escape its block.
  value;
  if let Some(payload) = Some({ count: 0 }) {
    payload.count++; // No deep immutability is implied.
  }
}
