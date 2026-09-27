import { ConfigurableModuleBuilder } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';

function positiveInteger(
  value: string | undefined,
  fallback: number,
  max: number,
) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > max) {
    throw new Error(`Operations configuration must be an integer in 1..${max}`);
  }
  return result;
}

export const operationsConfig = registerAs('operations', () => ({
  capacity: positiveInteger(process.env.LAB_OPERATIONS_CAPACITY, 100, 10000),
  holdMs: positiveInteger(process.env.LAB_OPERATIONS_HOLD_MS, 60000, 3600000),
}));

export type ReservationPolicy = ConfigType<typeof operationsConfig>;

export const {
  ConfigurableModuleClass: ReservationModuleDefinition,
  MODULE_OPTIONS_TOKEN: RESERVATION_POLICY,
} = new ConfigurableModuleBuilder<ReservationPolicy>()
  .setClassMethodName('forRoot')
  .build();
