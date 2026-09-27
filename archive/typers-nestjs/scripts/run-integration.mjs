import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.config.integration.ts',
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://typers:typers-demo-local@127.0.0.1:55432/typers',
      TEST_MONGO_URL: process.env.TEST_MONGO_URL ?? 'mongodb://127.0.0.1:57017',
      RUN_QUEUE_INTEGRATION: '1',
      RUN_BROKER_INTEGRATION: '1',
      MESSAGING_RABBITMQ_URL:
        process.env.MESSAGING_RABBITMQ_URL ??
        process.env.AMQP_URL ??
        'amqp://typers:typers-demo-local@127.0.0.1:56720',
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
