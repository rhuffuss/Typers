import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createLab, readJson } from './typers-lab-support.mjs';

const { values } = parseArgs({
  options: {
    compiler: { type: 'string' },
    core: { type: 'string' },
    nest: { type: 'string' },
    report: { type: 'string' },
    profile: { type: 'string', default: 'all' },
    'prepare-only': { type: 'boolean' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log(
    'pnpm demo:typers --compiler /path/compiler.tgz --core /path/core.tgz --nest /path/nest.tgz [--profile all|runtime|experimental|native-api|nest-adapter] [--prepare-only] [--report reports/typers-features.json]',
  );
  process.exit(0);
}
const profiles = ['runtime', 'experimental', 'native-api', 'nest-adapter'];
assert.ok(
  values.profile === 'all' || profiles.includes(values.profile),
  'Unknown profile',
);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lab = await createLab(root, values);
const { directory, modules, report, step } = lab;
const compiler = join(modules, '@typers/compiler/bin/typers.cjs');
const official = join(modules, 'typescript/bin/tsc');
const adapter = join(modules, '@typers/nest/bin/typers-nest.mjs');
const node = (id, cwd, args, reject, expectedExitCode) =>
  step(id, cwd, process.execPath, args, reject, expectedExitCode);
report.selectedProfile = values.profile;
report.commands = {
  runtime: [
    'node ../../node_modules/.bin/typers -p tsconfig.json',
    'node --test runtime.test.mjs',
  ],
  experimental: [
    'node ../../node_modules/.bin/typers -p tsconfig.json',
    'node --test experimental.test.mjs',
  ],
  'native-api': ['node run.mjs'],
  'nest-adapter': ['node run.mjs'],
};
try {
  console.log(`Reviewable workspace: ${directory}`);
  if (!values['prepare-only']) {
    const version = await node('compiler-version', directory, [
      compiler,
      '--version',
    ]);
    const alias = await node('tsc-command-alias', directory, [
      join(modules, '.bin/tsc'),
      '--version',
    ]);
    const help = await node('compiler-help', directory, [
      compiler,
      '--help',
      '--all',
    ]);
    const cliVersion = await readFile(
      join(directory, version.logs.stdout),
      'utf8',
    );
    assert.equal(cliVersion.trim(), `Version ${report.compilerBuild.version}`);
    assert.equal(
      await readFile(join(directory, alias.logs.stdout), 'utf8'),
      cliVersion,
    );
    assert.match(
      await readFile(join(directory, help.logs.stdout), 'utf8'),
      /experimentalTypersSyntax/,
    );
    for (const profile of profiles.filter(
      (p) => values.profile === 'all' || p === values.profile,
    )) {
      const cwd = join(directory, 'profiles', profile);
      if (profile === 'runtime' || profile === 'experimental') {
        await node(`${profile}-compile`, cwd, [
          compiler,
          '-p',
          'tsconfig.json',
          '--pretty',
          'false',
        ]);
        await node(`${profile}-node`, cwd, [
          '--test',
          '--test-reporter=tap',
          `${profile}.test.mjs`,
        ]);
        if (profile === 'runtime')
          await node('runtime-official-types', cwd, [
            official,
            '-p',
            'tsconfig.json',
            '--noEmit',
            '--pretty',
            'false',
          ]);
        else {
          await node('experimental-declarations-official', cwd, [
            official,
            '-p',
            'tsconfig.consumer.json',
            '--pretty',
            'false',
          ]);
          const officialConfig = await readJson(join(cwd, 'tsconfig.json'));
          delete officialConfig.compilerOptions.experimentalTypersSyntax;
          officialConfig.compilerOptions.noEmit = true;
          await writeFile(
            join(cwd, 'tsconfig.official.json'),
            JSON.stringify(officialConfig, null, 2),
          );
          await node(
            'experimental-official-rejection',
            cwd,
            [official, '-p', 'tsconfig.official.json', '--pretty', 'false'],
            /error TS1005:/,
            2,
          );
          const expectedCodes = {
            disabled: [1005],
            'wrong-operand': [1360],
            'wrong-pattern': [180001],
            destructuring: [1128, 1434, 180001, 180002],
            'missing-block': [180002],
            'promise-without-await': [1360],
            'missing-payload': [1360],
          };
          assert.deepEqual(
            (await readdir(join(cwd, 'negative'))).sort(),
            Object.keys(expectedCodes).sort(),
          );
          for (const [negative, codes] of Object.entries(expectedCodes)) {
            const result = await node(
              `experimental-negative-${negative}`,
              cwd,
              [
                compiler,
                '-p',
                `negative/${negative}/tsconfig.json`,
                '--pretty',
                'false',
              ],
              new RegExp(`error TS(?:${codes.join('|')})\\b`),
            );
            assert.deepEqual(
              result.diagnostics.sort((a, b) => a - b),
              codes,
              `${negative}: exact diagnostic codes`,
            );
          }
          // The same experimental Nest sources also travel through the real adapter.
          await writeFile(
            join(cwd, 'nest-cli.json'),
            JSON.stringify({
              sourceRoot: 'src',
              compilerOptions: {
                tsConfigPath: 'tsconfig.json',
                deleteOutDir: true,
              },
            }),
          );
          await node('experimental-adapter-build', cwd, [
            adapter,
            'build',
            '--compiler',
            '@typers/compiler',
            '--json',
          ]);
          await node('experimental-adapter-node', cwd, [
            '--test',
            '--test-reporter=tap',
            'experimental.test.mjs',
          ]);
        }
      } else {
        if (profile === 'native-api')
          await node('native-api-public-types', cwd, [
            compiler,
            '-p',
            'tsconfig.contracts.json',
            '--pretty',
            'false',
          ]);
        await node(`${profile}-node`, cwd, ['run.mjs']);
      }
    }
    report.completed = true;
    report.passed = true;
  } else {
    report.preparedOnly = true;
    report.completed = false;
  }
} catch (error) {
  report.completed = false;
  report.passed = false;
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await lab.verifyReference();
  } catch (error) {
    report.passed = false;
    report.error = error.message;
    process.exitCode = 1;
  }
  const output = resolve(root, values.report ?? 'reports/typers-features.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `Report: ${output}\nSources, emitted code and full diagnostics: ${directory}`,
  );
  if (values['prepare-only'])
    console.log(JSON.stringify(report.commands, null, 2));
}
