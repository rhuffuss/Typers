import { resolve } from 'node:path';

// Keep Nest's ESM/metadata/external dependency defaults; isolate only the output.
export default (defaults) => ({
  ...defaults,
  output: {
    ...defaults.output,
    path: resolve(process.cwd(), 'dist-tooling-rspack'),
  },
});
