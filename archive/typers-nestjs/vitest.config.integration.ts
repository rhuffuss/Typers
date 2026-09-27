import { defineConfig } from 'vitest/config';
import base from './vitest.config.e2e.js';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    outputFile: { json: 'reports/integration.json' },
    include: ['test/integration/**/*.integration-spec.ts'],
    fileParallelism: false,
    testTimeout: 45000,
    hookTimeout: 60000,
  },
});
