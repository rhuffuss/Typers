import {
  Err,
  None,
  Ok,
  Some,
  fromNullable,
  type Option,
  type Result,
} from '@typers/core';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

/** Compile only. The function is intentionally never executed. */
export function typeContracts(
  input: string | null | undefined,
  option: Option<number>,
  result: Result<number, string>,
): void {
  const present: Some<number> = Some(0);
  const absent: None = None;
  const success: Ok<number> = Ok(0);
  const failure: Err<string> = Err('stock unavailable');
  const converted = fromNullable(input);
  const nullableContract: Expect<Equal<typeof converted, Option<string>>> =
    true;
  const explicitUndefined: Some<undefined> = Some(undefined);
  const alwaysAbsent = fromNullable(null);
  const nullContract: Expect<Equal<typeof alwaysAbsent, Option<never>>> = true;

  if (option.kind === 'some') {
    const count: number = option.value;
    void count;
  } else {
    const none: None = option;
    void none;
  }
  if (result.kind === 'ok') result.value.toFixed();
  else result.error.toUpperCase();

  // @ts-expect-error Variant payloads are readonly.
  present.value = 1;
  // @ts-expect-error Discriminants are readonly.
  present.kind = 'some';
  // @ts-expect-error None is a value, not a constructor.
  None();
  // @ts-expect-error None has no payload.
  absent.value;
  // @ts-expect-error Successful Result has no error payload.
  success.error;
  // @ts-expect-error Err has no successful value.
  failure.value;
  // @ts-expect-error Error payloads are readonly.
  failure.error = 'changed';
  // @ts-expect-error Presence of undefined is not Option<number>.
  const wrongOption: Option<number> = Some(undefined);
  // @ts-expect-error The error type is part of the Result contract.
  const wrongError: Result<number, string> = Err(404);
  // @ts-expect-error The Option must be narrowed before reading its payload.
  option.value;
  // @ts-expect-error The Result must be narrowed before reading its payload.
  result.value;
  // @ts-expect-error Err is not an Option variant.
  const wrongVariant: Option<number> = Err('no stock');
  if (converted.kind === 'some') {
    const text: string = converted.value;
    // @ts-expect-error fromNullable removed null and undefined.
    const empty: null | undefined = converted.value;
    void [text, empty];
  }
  void [
    present,
    absent,
    success,
    failure,
    nullableContract,
    nullContract,
    explicitUndefined,
    wrongOption,
    wrongError,
    wrongVariant,
  ];
}
