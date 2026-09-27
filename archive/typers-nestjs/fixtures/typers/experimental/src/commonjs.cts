import core = require('@typers/core');

export function presentUnits(input: core.Option<number>): number {
  if let Some(units) = input { return units; }
  else { return -1; }
}
