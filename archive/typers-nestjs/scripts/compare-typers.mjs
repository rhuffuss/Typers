import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { finished } from 'node:stream/promises';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { values } = parseArgs({
  options: {
    compiler: { type: 'string' },
    core: { type: 'string' },
    nest: { type: 'string' },
    upstream: { type: 'string' },
    report: { type: 'string' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log(
    'node scripts/compare-typers.mjs --compiler /path/compiler.tgz --core /path/core.tgz --nest /path/nest.tgz [--upstream /path/installed/typescript] [--report reports/typers-comparison.json]',
  );
  process.exit(0);
}
for (const key of ['compiler', 'core', 'nest'])
  assert.ok(values[key], `--${key} must explicitly name a local tarball`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = resolve(
  root,
  values.report ?? 'reports/typers-comparison.json',
);
const runRoot = await realpath(await mkdtemp(join(tmpdir(), 'typers-corpus-')));
const snapshot = join(runRoot, 'snapshot');
const toolchain = join(runRoot, 'toolchain');
const logs = join(runRoot, 'logs');
await Promise.all([mkdir(snapshot), mkdir(logs), mkdir(toolchain)]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error(
        `Snapshot sources must not contain symlinks: ${directory}/${entry.name}`,
      );
    if (entry.isDirectory())
      result.push(...(await files(join(directory, entry.name), name)));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}

async function treeManifest(directory) {
  const entries = [];
  for (const path of await files(directory))
    entries.push({
      path,
      sha256: sha256(await readFile(join(directory, path))),
    });
  return {
    fileCount: entries.length,
    sha256: sha256(JSON.stringify(entries)),
    entries,
  };
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  runDirectory: runRoot,
  isolation:
    'Real copied sources/configuration/tarballs. Existing locked application dependencies linked per package; root TypeScript and node_modules are unchanged. No network/install or compiler fallback.',
  artifacts: [],
  sourceSnapshot: {},
  dependencies: {},
  profiles: [],
  comparisons: [],
  limitations: [
    'This is the standard TypeScript corpus, not experimental Result/Option or if-let syntax.',
    'Passing native CLI or typers-nest does not establish compatibility with the original Nest CLI, its compiler plugins, watch, aliases or every Nest API.',
    'Runtime checks exercise emitted local/memory applications; they do not rerun brokers, databases, SaaS or every Vitest test under Typers.',
    'Dependency contents are shared through links to the installed pnpm tree; this run does not independently reinstall or snapshot every dependency file.',
    'Failed compiler steps remain failures even when they emitted JavaScript that passes some runtime checks.',
  ],
};

async function step(id, cwd, executable, args, timeoutMs = 120_000) {
  const stdoutPath = join(logs, `${id}.stdout.log`);
  const stderrPath = join(logs, `${id}.stderr.log`);
  const stdout = createWriteStream(stdoutPath);
  const stderr = createWriteStream(stderrPath);
  const start = Date.now();
  let timedOut = false;
  let errorText;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DEMO_DATABASE: 'memory',
    NO_COLOR: '1',
  };
  for (const key of Object.keys(env))
    if (key.startsWith('OBSERVE_')) delete env[key];
  const child = spawn(executable, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const kill = (signal) => {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') errorText = error.message;
    }
  };
  let forceTimer;
  const timer = setTimeout(() => {
    timedOut = true;
    kill('SIGTERM');
    forceTimer = setTimeout(() => kill('SIGKILL'), 2000);
  }, timeoutMs);
  const outcome = await new Promise((resolveStep) => {
    child.once('error', (error) => {
      errorText = error.message;
    });
    child.once('close', (exitCode, signal) =>
      resolveStep({ exitCode, signal }),
    );
  });
  clearTimeout(timer);
  clearTimeout(forceTimer);
  await Promise.all([finished(stdout), finished(stderr)]);
  const out = await readFile(stdoutPath, 'utf8');
  const err = await readFile(stderrPath, 'utf8');
  const diagnosticCodes = {};
  for (const match of `${out}\n${err}`.matchAll(
    /(?:error|warning) TS(\d+):|"code":\s*(\d+)/g,
  )) {
    const code = `TS${match[1] ?? match[2]}`;
    diagnosticCodes[code] = (diagnosticCodes[code] ?? 0) + 1;
  }
  const result = {
    id,
    command: [executable === process.execPath ? 'node' : executable, ...args],
    ...outcome,
    status: timedOut ? 'timeout' : outcome.exitCode === 0 ? 'passed' : 'failed',
    durationMs: Date.now() - start,
    diagnosticCodes,
    logs: {
      stdout: relative(runRoot, stdoutPath),
      stderr: relative(runRoot, stderrPath),
    },
    outputSha256: { stdout: sha256(out), stderr: sha256(err) },
    ...(errorText ? { error: errorText } : {}),
    ...(err.trim() ? { stderrExcerpt: err.trim().slice(0, 1800) } : {}),
  };
  console.log(
    `${id}: ${result.status} (exit ${outcome.exitCode}, ${result.durationMs}ms)`,
  );
  return result;
}

try {
  const copied = [];
  for (const directory of ['src', 'test', 'scripts']) {
    for (const path of await files(join(root, directory)))
      copied.push(`${directory}/${path}`);
  }
  for (const name of await readdir(root)) {
    if (
      /^(tsconfig.*\.json|nest-cli.*\.json|vitest.*\.ts|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.oxlintrc\.json|\.swcrc|\.node-version|rspack\.config\.mjs)$/.test(
        name,
      )
    )
      copied.push(name);
  }
  const manifest = [];
  for (const path of copied.sort()) {
    const bytes = await readFile(join(root, path));
    await mkdir(dirname(join(snapshot, path)), { recursive: true });
    await writeFile(join(snapshot, path), bytes);
    manifest.push({ path, sha256: sha256(bytes) });
  }
  await writeFile(
    join(runRoot, 'source-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  report.sourceSnapshot = {
    fileCount: manifest.length,
    sha256: sha256(JSON.stringify(manifest)),
    manifest: 'source-manifest.json',
    generatedPrismaIncluded: manifest.some(({ path }) =>
      path.startsWith('src/persistence-labs/prisma/generated/'),
    ),
  };
  assert.ok(
    report.sourceSnapshot.generatedPrismaIncluded,
    'Run pnpm generate:prisma in the reference project before snapshotting',
  );
  const basePackage = await readJson(join(snapshot, 'package.json'));
  const baseTsconfig = await readJson(join(snapshot, 'tsconfig.json'));
  const baseBuildConfig = await readJson(join(snapshot, 'tsconfig.build.json'));
  const baseNestConfig = await readJson(join(snapshot, 'nest-cli.json'));
  report.configurations = {
    originalTsconfig: baseTsconfig,
    originalBuild: baseBuildConfig,
    originalNest: baseNestConfig,
  };

  const packages = new Map();
  for (const entry of await readdir(join(root, 'node_modules'), {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith('.')) continue;
    const names = entry.name.startsWith('@')
      ? (await readdir(join(root, 'node_modules', entry.name))).map(
          (name) => `${entry.name}/${name}`,
        )
      : [entry.name];
    for (const name of names) {
      const directory = await realpath(join(root, 'node_modules', name));
      if (await exists(join(directory, 'package.json')))
        packages.set(name, directory);
    }
  }
  const dependencyManifest = [];
  for (const [name, directory] of packages) {
    const bytes = await readFile(join(directory, 'package.json'));
    const pkg = JSON.parse(bytes);
    dependencyManifest.push({
      requestedName: name,
      installedName: pkg.name,
      version: pkg.version,
      packageJsonSha256: sha256(bytes),
      directory,
    });
  }
  await writeFile(
    join(runRoot, 'dependency-manifest.json'),
    JSON.stringify(dependencyManifest, null, 2),
  );
  report.dependencies = {
    packageManager: basePackage.packageManager,
    lockfileSha256: sha256(await readFile(join(snapshot, 'pnpm-lock.yaml'))),
    linkedPackages: packages.size,
    manifest: 'dependency-manifest.json',
    manifestSha256: sha256(JSON.stringify(dependencyManifest)),
    baselineTypeScript: (
      await readJson(join(packages.get('typescript'), 'package.json'))
    ).version,
  };
  for (const key of ['compiler', 'core', 'nest']) {
    const source = resolve(values[key]);
    const bytes = await readFile(source);
    const artifact = join(toolchain, `${key}-${sha256(bytes)}.tgz`);
    await writeFile(artifact, bytes);
    const target = join(toolchain, 'node_modules', '@typers', key);
    await mkdir(target, { recursive: true });
    const listing = await step(`list-${key}`, toolchain, 'tar', [
      '-tzf',
      artifact,
    ]);
    assert.equal(listing.status, 'passed', `Could not inspect ${key} archive`);
    for (const entry of (
      await readFile(join(runRoot, listing.logs.stdout), 'utf8')
    )
      .trim()
      .split('\n')) {
      assert.ok(
        entry.startsWith('package/') && !entry.split('/').includes('..'),
        `Unsafe archive entry: ${entry}`,
      );
    }
    const extraction = await step(`extract-${key}`, toolchain, 'tar', [
      '-xzf',
      artifact,
      '-C',
      target,
      '--strip-components=1',
    ]);
    assert.equal(
      extraction.status,
      'passed',
      `Could not extract ${key}; see ${logs}`,
    );
    const pkg = await readJson(join(target, 'package.json'));
    assert.equal(pkg.name, `@typers/${key}`);
    packages.set(pkg.name, target);
    report.artifacts.push({
      filename: basename(source),
      name: pkg.name,
      version: pkg.version,
      sha256: sha256(bytes),
      installedManifestSha256: sha256(
        await readFile(join(target, 'package.json')),
      ),
    });
  }
  const buildInfo = await readJson(
    join(packages.get('@typers/compiler'), 'build-info.json'),
  );
  report.compilerBuild = buildInfo;
  report.compilerBuild.nativeExecutableSha256 = sha256(
    await readFile(
      join(
        packages.get('@typers/compiler'),
        'native',
        process.platform === 'win32' ? 'typers.exe' : 'typers',
      ),
    ),
  );
  const adapterPkg = await readJson(
    join(packages.get('@typers/nest'), 'package.json'),
  );
  const minimatchRoot = await realpath(
    join(
      root,
      'node_modules/.pnpm',
      `minimatch@${adapterPkg.dependencies.minimatch}`,
      'node_modules/minimatch',
    ),
  );
  const minimatchPkg = await readJson(join(minimatchRoot, 'package.json'));
  assert.equal(minimatchPkg.version, adapterPkg.dependencies.minimatch);
  await symlink(
    minimatchRoot,
    join(toolchain, 'node_modules', 'minimatch'),
    'dir',
  );
  report.adapterDependency = {
    name: 'minimatch',
    version: minimatchPkg.version,
    packageJsonSha256: sha256(
      await readFile(join(minimatchRoot, 'package.json')),
    ),
    linkTarget: minimatchRoot,
  };
  const { minimatch } = await import(join(minimatchRoot, 'dist/esm/index.js'));

  let upstreamLauncher;
  if (values.upstream) {
    const upstreamSource = await realpath(resolve(values.upstream));
    const upstreamPackage = await readJson(
      join(upstreamSource, 'package.json'),
    );
    assert.equal(upstreamPackage.name, 'typescript');
    assert.equal(
      upstreamPackage.version,
      buildInfo.upstreamVersion,
      'Optional upstream must match the Typers declared upstreamVersion',
    );
    const target = join(toolchain, 'upstream/node_modules/typescript');
    await cp(upstreamSource, target, { recursive: true, dereference: true });
    const platformName = `@typescript/typescript-${process.platform}-${process.arch}`;
    const upstreamRequire = createRequire(join(upstreamSource, 'package.json'));
    const platformSource = dirname(
      upstreamRequire.resolve(`${platformName}/package.json`),
    );
    const platformTarget = join(
      toolchain,
      'upstream/node_modules',
      platformName,
    );
    await cp(platformSource, platformTarget, {
      recursive: true,
      dereference: true,
    });
    const upstreamManifest = await treeManifest(join(toolchain, 'upstream'));
    await writeFile(
      join(runRoot, 'upstream-manifest.json'),
      JSON.stringify(upstreamManifest.entries, null, 2),
    );
    report.upstream = {
      name: upstreamPackage.name,
      version: upstreamPackage.version,
      platformPackage: platformName,
      sha256: upstreamManifest.sha256,
      files: upstreamManifest.fileCount,
      manifest: 'upstream-manifest.json',
      gitHead: upstreamPackage.gitHead,
    };
    upstreamLauncher = join(target, 'bin/tsc');
  } else
    report.upstream = {
      status: 'not-run',
      reason: 'No explicit --upstream installed package supplied',
    };

  report.launcherVersions = [];
  for (const [id, launcher] of [
    ['typers', join(packages.get('@typers/compiler'), 'bin/typers.cjs')],
    ['baseline', join(packages.get('typescript'), 'bin/tsc')],
    ...(upstreamLauncher ? [['upstream', upstreamLauncher]] : []),
  ]) {
    const version = await step(`${id}-version`, snapshot, process.execPath, [
      launcher,
      '--version',
    ]);
    report.launcherVersions.push({
      id,
      status: version.status,
      output: (
        await readFile(join(runRoot, version.logs.stdout), 'utf8')
      ).trim(),
      launcherSha256: sha256(await readFile(launcher)),
    });
  }

  async function consumer(name, patches = {}) {
    const directory = join(runRoot, name);
    await cp(snapshot, directory, { recursive: true });
    for (const [file, contents] of Object.entries(patches))
      await writeFile(join(directory, file), JSON.stringify(contents, null, 2));
    for (const [name, target] of packages) {
      const link = join(directory, 'node_modules', name);
      await mkdir(dirname(link), { recursive: true });
      await symlink(target, link, 'dir');
    }
    return directory;
  }

  async function copyAssets(directory) {
    const sourceRoot = resolve(directory, baseNestConfig.sourceRoot);
    const rootDir = resolve(directory, baseBuildConfig.compilerOptions.rootDir);
    const output = resolve(directory, baseTsconfig.compilerOptions.outDir);
    const copied = [];
    for (const asset of baseNestConfig.compilerOptions.assets) {
      assert.equal(
        typeof asset,
        'string',
        'Manual native-CLI asset copying currently supports the baseline string patterns only',
      );
      for (const path of await files(sourceRoot)) {
        if (!minimatch(path, asset, { dot: true })) continue;
        const source = join(sourceRoot, path);
        const destination = resolve(output, relative(rootDir, source));
        assert.ok(
          destination.startsWith(`${output}${sep}`),
          'Asset destination must stay in output',
        );
        await mkdir(dirname(destination), { recursive: true });
        await cp(source, destination);
        copied.push(relative(output, destination));
      }
    }
    return [...new Set(copied)].sort();
  }

  async function runtimeChecks(profile, directory, copy) {
    const output = join(directory, 'dist');
    if (!(await exists(join(output, 'app.module.js')))) {
      profile.runtime = {
        status: 'not-run',
        reason: 'No emitted app.module.js',
      };
      return;
    }
    profile.assets = copy
      ? {
          mechanism:
            'Explicit copy of unchanged Nest asset string patterns after native CLI emission',
          files: await copyAssets(directory),
        }
      : { mechanism: 'typers-nest native adapter asset handling' };
    profile.output = await treeManifest(output);
    await writeFile(
      join(runRoot, `${profile.id}-output-manifest.json`),
      JSON.stringify(profile.output.entries, null, 2),
    );
    delete profile.output.entries;
    profile.runtime = [];
    for (const script of [
      'check-emitted.mjs',
      'check-business-emitted.mjs',
      'check-advanced-emitted.mjs',
    ]) {
      if (!(await exists(join(directory, 'scripts', script)))) {
        profile.runtime.push({
          id: script,
          status: 'not-run',
          reason: 'Harness absent from source snapshot',
        });
        continue;
      }
      profile.runtime.push(
        await step(
          `${profile.id}-${script.replace('.mjs', '')}`,
          directory,
          process.execPath,
          [`scripts/${script}`, 'dist'],
          60_000,
        ),
      );
    }
  }

  const profiles = [
    {
      id: 'baseline-ts6-build',
      launcher: 'node_modules/typescript/bin/tsc',
      args: ['-p', 'tsconfig.build.json', '--pretty', 'false'],
      copyAssets: true,
      patches: {},
    },
    {
      id: 'baseline-ts6-typecheck',
      launcher: 'node_modules/typescript/bin/tsc',
      args: ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'],
      patches: {},
    },
    {
      id: 'typers-native-build',
      launcher: 'node_modules/@typers/compiler/bin/typers.cjs',
      args: ['-p', 'tsconfig.build.json', '--pretty', 'false'],
      copyAssets: true,
      patches: {},
    },
    {
      id: 'typers-native-typecheck',
      launcher: 'node_modules/@typers/compiler/bin/typers.cjs',
      args: ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'],
      patches: {},
    },
    {
      id: 'typers-adapter-original',
      launcher: 'node_modules/@typers/nest/bin/typers-nest.mjs',
      args: ['build', '--compiler', '@typers/compiler', '--json'],
      expected:
        'unsupported watchAssets: true (still recorded as a failed build)',
      rejectionDiagnostic:
        'compilerOptions.watchAssets is not supported by typers-nest build',
      patches: {},
    },
    {
      id: 'typers-adapter-no-watch',
      launcher: 'node_modules/@typers/nest/bin/typers-nest.mjs',
      args: ['build', '--compiler', '@typers/compiler', '--json'],
      expected:
        'unsupported incremental: true (still recorded as a failed build)',
      rejectionDiagnostic:
        'typersEmitProject does not support incremental, composite, or project references',
      patches: {
        'nest-cli.json': {
          ...baseNestConfig,
          compilerOptions: {
            ...baseNestConfig.compilerOptions,
            watchAssets: false,
          },
        },
      },
    },
    {
      id: 'typers-adapter-supported',
      launcher: 'node_modules/@typers/nest/bin/typers-nest.mjs',
      args: ['build', '--compiler', '@typers/compiler', '--json'],
      copyAssets: false,
      patches: {
        'nest-cli.json': {
          ...baseNestConfig,
          compilerOptions: {
            ...baseNestConfig.compilerOptions,
            watchAssets: false,
          },
        },
        'tsconfig.json': {
          ...baseTsconfig,
          compilerOptions: {
            ...baseTsconfig.compilerOptions,
            incremental: false,
          },
        },
      },
    },
  ];
  if (upstreamLauncher)
    profiles.push(
      {
        id: 'upstream-ts7-build',
        launcher: upstreamLauncher,
        args: ['-p', 'tsconfig.build.json', '--pretty', 'false'],
        copyAssets: true,
        patches: {},
      },
      {
        id: 'upstream-ts7-typecheck',
        launcher: upstreamLauncher,
        args: ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'],
        patches: {},
      },
    );
  for (const definition of profiles) {
    const directory = await consumer(definition.id, definition.patches);
    const profile = {
      id: definition.id,
      configurationOverrides: definition.patches,
      ...(definition.expected ? { expectedOutcome: definition.expected } : {}),
      build: await step(definition.id, directory, process.execPath, [
        definition.launcher,
        ...definition.args,
      ]),
    };
    report.profiles.push(profile);
    if (definition.rejectionDiagnostic) {
      const stderr = await readFile(
        join(runRoot, profile.build.logs.stderr),
        'utf8',
      );
      profile.expectedRejection = {
        diagnostic: definition.rejectionDiagnostic,
        matched:
          profile.build.status === 'failed' &&
          stderr.includes(definition.rejectionDiagnostic),
      };
    }
    if (Object.hasOwn(definition, 'copyAssets'))
      await runtimeChecks(profile, directory, definition.copyAssets);
    else if (definition.id.includes('adapter'))
      profile.runtime = {
        status: 'not-run',
        reason: 'Rejected original/diagnostic configuration profile',
      };
  }

  report.language = [];
  const referenceScenarios = new Map();
  for (const compiler of [
    {
      id: 'baseline-ts6',
      consumer: 'baseline-ts6-build',
      launcher: 'node_modules/typescript/bin/tsc',
    },
    {
      id: 'typers-native',
      consumer: 'typers-native-build',
      launcher: 'node_modules/@typers/compiler/bin/typers.cjs',
    },
    ...(upstreamLauncher
      ? [
          {
            id: 'upstream-ts7',
            consumer: 'upstream-ts7-build',
            launcher: upstreamLauncher,
          },
        ]
      : []),
  ]) {
    const parent = join(runRoot, compiler.consumer);
    const helperPath = join(parent, 'src/language-lab/prepare-workspace.ts');
    if (!(await exists(helperPath))) {
      report.language.push({
        compiler: compiler.id,
        status: 'not-run',
        reason: 'Language helper is absent from the source snapshot',
      });
      continue;
    }
    const { prepareLanguageWorkspace } = await import(
      pathToFileURL(helperPath)
    );
    const generated = await prepareLanguageWorkspace(parent);
    const directory = join(runRoot, `${compiler.id}-language`);
    try {
      await cp(generated.directory, directory, {
        recursive: true,
        filter: (path) => basename(path) !== 'node_modules',
      });
    } finally {
      await generated.close();
    }
    await symlink(
      join(parent, 'node_modules'),
      join(directory, 'node_modules'),
      'dir',
    );
    const sources = await treeManifest(join(directory, 'src'));
    const language = {
      compiler: compiler.id,
      sourceFiles: sources.fileCount,
      sourceSha256: sources.sha256,
      builds: [],
      scenarios: [],
    };
    report.language.push(language);
    for (const profile of ['core', 'decorators', 'report', 'contracts']) {
      language.builds.push(
        await step(
          `${compiler.id}-language-${profile}`,
          directory,
          process.execPath,
          [
            compiler.launcher,
            '-p',
            `tsconfig.${profile}.json`,
            '--pretty',
            'false',
          ],
        ),
      );
    }
    for (const entry of [
      'core/events.main',
      'core/mixins.main',
      'core/imports.main',
      'decorators/main',
      'report/main',
      'resources/main',
    ]) {
      if (!(await exists(join(directory, 'dist', `${entry}.js`)))) {
        language.scenarios.push({
          entry,
          status: 'not-run',
          reason: 'No emitted JavaScript for this scenario',
        });
        continue;
      }
      const execution = await step(
        `${compiler.id}-language-run-${entry.replaceAll('/', '-')}`,
        directory,
        process.execPath,
        [`dist/${entry}.js`],
        30_000,
      );
      const scenario = { entry, ...execution };
      language.scenarios.push(scenario);
      if (execution.status === 'passed') {
        try {
          const data = JSON.parse(
            await readFile(join(runRoot, execution.logs.stdout), 'utf8'),
          );
          scenario.resultSha256 = sha256(JSON.stringify(data));
          if (compiler.id === 'baseline-ts6')
            referenceScenarios.set(entry, data);
          else {
            scenario.matchesBaseline =
              referenceScenarios.has(entry) &&
              isDeepStrictEqual(data, referenceScenarios.get(entry));
            if (!scenario.matchesBaseline) scenario.status = 'failed';
          }
        } catch (error) {
          scenario.status = 'failed';
          scenario.resultError = error.message;
        }
      }
    }
  }

  for (const other of ['upstream-ts7-build', 'typers-adapter-supported']) {
    const first = join(runRoot, 'typers-native-build-output-manifest.json');
    const second = join(runRoot, `${other}-output-manifest.json`);
    if (!(await exists(first)) || !(await exists(second))) {
      report.comparisons.push({
        reference: 'typers-native-build',
        target: other,
        status: 'not-run',
        reason: 'Both output manifests are required',
      });
      continue;
    }
    const a = new Map(
      (await readJson(first)).map((file) => [file.path, file.sha256]),
    );
    const b = new Map(
      (await readJson(second)).map((file) => [file.path, file.sha256]),
    );
    const differences = [...new Set([...a.keys(), ...b.keys()])]
      .sort()
      .filter((path) => a.get(path) !== b.get(path));
    report.comparisons.push({
      reference: 'typers-native-build',
      target: other,
      referenceFiles: a.size,
      targetFiles: b.size,
      differingFiles: differences.length,
      examples: differences.slice(0, 12),
      note: 'Byte comparison for this copied corpus only, including declarations/maps/assets; not an API or compiler compatibility proof.',
    });
  }
  report.completed = true;
  report.referenceIntegrity = {
    baselineTypeScriptPackageUnchanged:
      sha256(
        await readFile(join(packages.get('typescript'), 'package.json')),
      ) ===
      dependencyManifest.find(
        ({ requestedName }) => requestedName === 'typescript',
      ).packageJsonSha256,
    lockfileUnchanged:
      sha256(await readFile(join(root, 'pnpm-lock.yaml'))) ===
      report.dependencies.lockfileSha256,
  };
  const counts = (entries) =>
    entries.reduce((result, entry) => {
      result[entry.status] = (result[entry.status] ?? 0) + 1;
      return result;
    }, {});
  const runtime = report.profiles.flatMap((profile) => profile.runtime ?? []);
  const languageBuilds = report.language.flatMap(
    (language) => language.builds ?? [],
  );
  const languageScenarios = report.language.flatMap(
    (language) => language.scenarios ?? [],
  );
  const unexpectedOutcomes = [];
  for (const profile of report.profiles) {
    if (profile.expectedRejection) {
      if (!profile.expectedRejection.matched)
        unexpectedOutcomes.push(
          `${profile.id}: expected diagnostic rejection did not match`,
        );
    } else {
      if (profile.build.status !== 'passed')
        unexpectedOutcomes.push(`${profile.id}: build ${profile.build.status}`);
      for (const execution of [profile.runtime ?? []].flat())
        if (execution.status !== 'passed')
          unexpectedOutcomes.push(
            `${profile.id}: runtime ${execution.id ?? execution.reason} ${execution.status}`,
          );
    }
  }
  for (const language of report.language) {
    if (language.status === 'not-run')
      unexpectedOutcomes.push(`${language.compiler}: language not run`);
    for (const execution of [
      ...(language.builds ?? []),
      ...(language.scenarios ?? []),
    ])
      if (execution.status !== 'passed')
        unexpectedOutcomes.push(
          `${language.compiler}: ${execution.id ?? execution.entry} ${execution.status}`,
        );
  }
  for (const [check, unchanged] of Object.entries(report.referenceIntegrity))
    if (!unchanged)
      unexpectedOutcomes.push(`Reference integrity: ${check} is false`);
  report.summary = {
    builds: counts(report.profiles.map((profile) => profile.build)),
    runtimeHarnesses: counts(runtime),
    languageBuilds: counts(languageBuilds),
    languageScenarios: counts(languageScenarios),
    matchedExpectedRejections: report.profiles.filter(
      (profile) => profile.expectedRejection?.matched,
    ).length,
    unexpectedOutcomes,
    gatePassed: unexpectedOutcomes.length === 0,
    meaning:
      'Exit 0 requires successful measured build/runtime/language profiles and both exact expected adapter rejections. Rejected builds remain failed. This is a corpus gate, not universal compatibility; byte comparisons are informational.',
  };
  if (!report.summary.gatePassed) process.exitCode = 1;
} catch (error) {
  report.completed = false;
  report.harnessError = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    join(runRoot, 'comparison.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `Report: ${reportPath}\nRetained snapshot, outputs and full diagnostics: ${runRoot}`,
  );
}
