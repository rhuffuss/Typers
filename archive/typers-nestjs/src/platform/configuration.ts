import { z } from 'zod';

const environment = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  DEMO_UPSTREAM_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
});

export function validateEnvironment(values: Record<string, unknown>) {
  const parsed = environment.parse(values);
  if (parsed.NODE_ENV === 'production' && !parsed.SESSION_SECRET) {
    throw new Error(
      'SESSION_SECRET (at least 32 characters) is required in production',
    );
  }
  return { ...values, ...parsed };
}
