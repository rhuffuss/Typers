export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const failure = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export function andThen<T, U, E>(
  result: Result<T, E>,
  next: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? next(result.value) : result;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled pricing variant: ${String(value)}`);
}
