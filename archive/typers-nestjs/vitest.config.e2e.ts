import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^graphql$/,
        replacement: fileURLToPath(
          new URL('./node_modules/graphql/index.js', import.meta.url),
        ),
      },
    ],
  },
  test: {
    reporters: ['default', 'json'],
    outputFile: { json: 'reports/e2e.json' },
    env: { NODE_ENV: 'test', DEMO_DATABASE: 'memory' },
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    exclude: ['node_modules/**', 'dist*/**'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
