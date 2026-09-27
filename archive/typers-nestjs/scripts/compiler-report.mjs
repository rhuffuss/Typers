import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const packages = [
  'typescript',
  '@nestjs/cli',
  '@nestjs/core',
  'vitest',
  '@swc/core',
];
const info = packages.map((name) => {
  const path = realpathSync(`node_modules/${name}/package.json`);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  return {
    requestedName: name,
    installedName: pkg.name,
    version: pkg.version,
    path,
  };
});
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      compilerEntry: require.resolve('typescript'),
      packages: info,
    },
    null,
    2,
  ),
);
