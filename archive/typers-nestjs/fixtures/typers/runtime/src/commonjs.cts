import core = require('@typers/core');

/** This .cts consumer must emit CommonJS and select the require package exports. */
export function reserve(
  units: number,
  available: core.Option<number>,
): core.Result<number, string> {
  if (!Number.isInteger(units) || units < 1) return core.Err('INVALID_UNITS');
  if (available.kind === 'none') return core.Err('UNKNOWN_SKU');
  if (available.value < units) return core.Err('INSUFFICIENT_STOCK');
  return core.Ok(available.value - units);
}

export const commonjsCore = core;
