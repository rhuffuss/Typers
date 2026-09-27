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
    outputFile: { json: 'reports/unit.json' },
    env: { NODE_ENV: 'test', DEMO_DATABASE: 'memory' },
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist*/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main*.ts', 'src/**/*.spec.ts'],
    },
  },
});
