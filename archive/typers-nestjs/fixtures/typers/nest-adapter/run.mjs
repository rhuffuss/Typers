import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  symlink,
} from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildNest } from '@typers/nest';

const root = dirname(fileURLToPath(import.meta.url));
const runRoot = await mkdtemp(join(root, 'runs-'));
const cli = fileURLToPath(
  import.meta.resolve('@typers/nest/package.json'),
).replace(/package\.json$/, 'bin/typers-nest.mjs');
const sourceConfig = JSON.parse(
  await readFile(join(root, 'nest-cli.json'), 'utf8'),
);
const checks = [];
const rejections = [];
const record = (name) => checks.push({ name, status: 'passed' });
const json = (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + '\n');
const sha = (value) => createHash('sha256').update(value).digest('hex');
async function manifest(directory) {
  const entries = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const file = join(directory, entry.name);
    if (entry.isDirectory())
      for (const child of await manifest(file))
        entries.push([`${entry.name}/${child[0]}`, child[1]]);
    else entries.push([entry.name, sha(await readFile(file))]);
  }
  return entries;
}
async function workspace(name) {
  const cwd = join(runRoot, name);
  await mkdir(cwd, { recursive: true });
  for (const file of [
    'src',
    'package.json',
    'tsconfig.json',
    'tsconfig.base.json',
    'nest-cli.json',
  ]) {
    await cp(join(root, file), join(cwd, file), { recursive: true });
  }
  return cwd;
}
async function build(cwd, options = {}) {
  return buildNest({ cwd, compilerPackage: '@typers/compiler', ...options });
}
async function assertPreserved(cwd, name, operation, pattern) {
  const before = await manifest(join(cwd, 'dist'));
  let failure;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, `Expected the adapter to reject: ${name}`);
  assert.match(failure.message, pattern);
  rejections.push({
    name,
    status: 'failed',
    expected: true,
    diagnostic: failure.message,
  });
  assert.deepEqual(await manifest(join(cwd, 'dist')), before, name);
  record(`${name}: previous output preserved`);
}

const cwd = await workspace('root');
await mkdir(join(cwd, 'dist'));
await writeFile(join(cwd, 'dist/stale.txt'), 'old build');
// A real binary asset is produced before compilation, independently of TypeScript.
await writeFile(
  join(cwd, 'src/downloads/sample.bin'),
  Buffer.from([0, 255, 13, 10, 128]),
);
const first = await build(cwd);
assert.equal(first.success, true);
assert.equal(first.compiler.name, '@typers/compiler');
assert.ok(first.emittedFiles.some((file) => file.endsWith('.d.ts.map')));
assert.ok(!first.emittedFiles.some((file) => file.endsWith('stale.txt')));
assert.ok(!(await readdir(join(cwd, 'dist'))).includes('stale.txt'));
assert.equal(
  (await readFile(join(cwd, 'dist/templates/.revision'), 'utf8')).trim(),
  'policy-v1',
);
assert.ok(
  !first.assetFiles.some((file) =>
    relative(cwd, file).includes('templates/private/'),
  ),
);
assert.deepEqual(
  await readFile(join(cwd, 'public-assets/downloads/sample.bin')),
  Buffer.from([0, 255, 13, 10, 128]),
);
record(
  'buildNest: JS/declarations/maps, cleanup, globs, directories, exclusion, hidden/binary/separate assets',
);

const { createPolicyApp, ExpensePolicyController, ExpensePolicyService } =
  await import(pathToFileURL(join(cwd, 'dist/app.js')).href);
assert.deepEqual(
  Reflect.getMetadata('design:paramtypes', ExpensePolicyController),
  [ExpensePolicyService],
);
const app = await createPolicyApp();
try {
  await app.listen(0, '127.0.0.1');
  const response = await fetch(`${await app.getUrl()}/expenses/policy`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    currency: 'EUR',
    approvalThresholdMinor: 500000,
    reviewers: ['approver', 'finance'],
  });
  assert.equal((await fetch(`${await app.getUrl()}/missing`)).status, 404);
} finally {
  await app.close();
}
record(
  'emitted Nest: constructor metadata, DI, HTTP 200/404 and copied policy asset',
);

const cliCwd = await workspace('cli');
await writeFile(
  join(cliCwd, 'src/downloads/sample.bin'),
  Buffer.from([0, 255, 13, 10, 128]),
);
const command = spawnSync(
  process.execPath,
  [cli, 'build', '--compiler', '@typers/compiler', '--json'],
  { cwd: cliCwd, encoding: 'utf8', timeout: 60_000 },
);
assert.equal(command.status, 0, command.stderr);
assert.equal(JSON.parse(command.stdout).success, true);
assert.deepEqual(
  await manifest(join(cwd, 'dist')),
  await manifest(join(cliCwd, 'dist')),
);
record('typers-nest CLI --json and buildNest API emit identical bytes');

const named = await workspace('named');
const namedConfig = structuredClone(sourceConfig);
delete namedConfig.compilerOptions.tsConfigPath;
namedConfig.projects['review.api'].compilerOptions.builder.options.configPath =
  'tsconfig.named.json';
await json(join(named, 'nest-cli.named.json'), namedConfig);
await json(join(named, 'tsconfig.named.json'), {
  extends: './tsconfig.json',
  compilerOptions: { outDir: 'dist-named' },
});
const selected = await build(named, {
  project: 'review.api',
  config: 'nest-cli.named.json',
});
assert.equal(selected.project, 'review.api');
assert.equal(selected.assetFiles.length, 1);
assert.ok(selected.emittedFiles.length > 0);
assert.ok(
  selected.emittedFiles.every((file) =>
    file.startsWith(join(named, 'dist-named')),
  ),
);
record(
  'named dotted project, builder.options.configPath, replacement of root asset array',
);
await json(join(named, 'tsconfig.override.json'), {
  extends: './tsconfig.json',
  compilerOptions: { outDir: 'dist-override' },
});
const override = await build(named, {
  project: 'review.api',
  config: 'nest-cli.named.json',
  path: 'tsconfig.override.json',
});
assert.ok(
  override.emittedFiles.every((file) =>
    file.startsWith(join(named, 'dist-override')),
  ),
);
record('explicit path overrides project configPath');

const noEmit = await workspace('no-emit');
await build(noEmit);
const prior = await manifest(join(noEmit, 'dist'));
await json(join(noEmit, 'tsconfig.json'), {
  extends: './tsconfig.base.json',
  compilerOptions: { noEmit: true },
  include: ['src/**/*.ts'],
});
const skipped = await build(noEmit);
assert.equal(skipped.success, true);
assert.equal(skipped.emitSkipped, true);
assert.deepEqual(await manifest(join(noEmit, 'dist')), prior);
record('noEmit succeeds without modifying old JS or assets');
await json(join(noEmit, 'tsconfig.json'), {
  extends: './tsconfig.base.json',
  include: ['src/**/*.ts'],
});
await writeFile(
  join(noEmit, 'src/error.ts'),
  'export const amount: number = "invalid";\n',
);
const invalid = await build(noEmit);
assert.equal(invalid.success, false);
assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.code === 2322));
assert.deepEqual(await manifest(join(noEmit, 'dist')), prior);
rejections.push({
  name: 'invalid types',
  status: 'failed',
  expected: true,
  diagnostics: invalid.diagnostics,
});
record('TS2322 preserves previous outputs');

for (const [name, configPatch, pattern] of [
  ['plugins', { plugins: ['@nestjs/swagger'] }, /plugins.*not supported/],
  ['watchAssets', { watchAssets: true }, /watchAssets.*not supported/],
  ['builder', { builder: 'swc' }, /builder/],
  [
    'asset collision',
    { assets: [{ include: 'app.ts', outDir: 'src' }] },
    /source|overlap|protected|collid/i,
  ],
]) {
  await json(join(cwd, 'nest-cli.json'), {
    ...sourceConfig,
    compilerOptions: { ...sourceConfig.compilerOptions, ...configPatch },
  });
  await assertPreserved(cwd, name, () => build(cwd), pattern);
}
await json(join(cwd, 'nest-cli.json'), sourceConfig);
await json(join(cwd, 'tsconfig.json'), {
  extends: './tsconfig.base.json',
  compilerOptions: { paths: { '@business/*': ['./src/*'] } },
  include: ['src/**/*.ts'],
});
await assertPreserved(cwd, 'paths aliases', () => build(cwd), /paths|aliases/);
await json(join(cwd, 'tsconfig.json'), {
  extends: './dist/base.json',
  include: ['src/**/*.ts'],
});
const protectedBase = {
  compilerOptions: {
    ...JSON.parse(await readFile(join(cwd, 'tsconfig.base.json'), 'utf8'))
      .compilerOptions,
    rootDir: '../src',
    outDir: '.',
  },
};
await json(join(cwd, 'dist/base.json'), protectedBase);
await assertPreserved(
  cwd,
  'extends inside outDir',
  () => build(cwd),
  /configuration|protected|overlap/i,
);
assert.deepEqual(
  JSON.parse(await readFile(join(cwd, 'dist/base.json'), 'utf8')),
  protectedBase,
);

// Source symlink rejection is checked in an owned scratch workspace.
const linked = await workspace('symlink');
await build(linked);
await symlink(
  join(linked, 'src/policies/expenses.json'),
  join(linked, 'src/policies/linked.json'),
);
await assertPreserved(linked, 'asset symlink', () => build(linked), /symlink/i);

console.log(
  JSON.stringify(
    { checks, rejections, exampleRoot: root, firstBuild: first },
    null,
    2,
  ),
);
