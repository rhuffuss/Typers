// Experimental syntax is isolated here. Its structural input needs no runtime import.
export function chooseCapacity(
  option: { kind: 'some'; value: number } | { kind: 'none' },
): number {
  if let Some(capacity) = option {
    return capacity;
  }
  return 0;
}
