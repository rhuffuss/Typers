import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'apps/typers');
const action = process.argv[2] ?? 'start';
assert.ok(
  ['start', 'build', 'test', 'typecheck', 'refresh'].includes(action),
  `Unknown Typers app action: ${action}`,
);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const manifestBytes = await readFile(join(app, 'package.json'));
const manifest = JSON.parse(manifestBytes);
const markerFile = join(app, 'node_modules/.typers-app-artifacts.json');
const artifacts = {};
for (const [name, specifier] of Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  if (!name.startsWith('@typers/')) continue;
  assert.ok(
    specifier.startsWith('file:'),
    'Typers packages must be explicit local artifacts',
  );
  const file = resolve(app, specifier.slice(5));
  if (!(await exists(file))) {
    throw new Error(
      `Missing ${file}. Build the Typers packages first; see apps/typers/README.md. No alternate compiler will be used.`,
    );
  }
  artifacts[name] = { file, sha256: sha256(await readFile(file)) };
}
const expectedMarker = {
  packageJsonSha256: sha256(JSON.stringify(manifest)),
  artifacts,
};
const rootLockBefore = sha256(await readFile(join(root, 'pnpm-lock.yaml')));
const rootCompilerBefore = await realpath(
  join(root, 'node_modules/typescript'),
);

// Forward IDE/terminal Stop to the child. Build/test are finite; start deliberately
// leaves the real Node/Nest process attached to this run configuration.
async function execute(executable, args) {
  const env = { ...process.env };
  // A parent pnpm run may inject workspace paths. Install into this app explicitly.
  for (const key of [
    'npm_config_workspace_dir',
    'npm_config_lockfile_dir',
    'npm_config_virtual_store_dir',
    'npm_config_local_prefix',
  ])
    delete env[key];
  const child = spawn(executable, args, { cwd: app, env, stdio: 'inherit' });
  let forcedExit;
  const stop = (signal) => {
    child.kill(signal);
    forcedExit ??= setTimeout(() => child.kill('SIGKILL'), 8000);
    forcedExit.unref();
  };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    const outcome = await new Promise((resolveChild, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolveChild({ code, signal }));
    });
    if (outcome.signal || outcome.code !== 0) {
      const error = new Error(
        `${executable} ${args.join(' ')} exited with ${outcome.signal ?? outcome.code}`,
      );
      error.exitCode =
        outcome.code ?? (outcome.signal === 'SIGINT' ? 130 : 143);
      throw error;
    }
  } finally {
    clearTimeout(forcedExit);
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
}

try {
  const marker = (await exists(markerFile))
    ? await json(markerFile)
    : undefined;
  const changedArtifacts =
    marker && JSON.stringify(marker) !== JSON.stringify(expectedMarker);
  if (changedArtifacts && action !== 'refresh') {
    throw new Error(
      'Typers artifacts or app dependencies changed. Run pnpm typers:refresh to update the app lockfile and installed packages, then start again.',
    );
  }
  if (!marker || action === 'refresh') {
    console.log(
      'Installing the Typers application dependencies with pnpm in apps/typers…',
    );
    await execute('pnpm', [
      '--dir',
      app,
      'install',
      '--lockfile-dir',
      app,
      '--ignore-workspace',
      '--ignore-scripts',
      ...(action === 'refresh'
        ? ['--no-frozen-lockfile', '--force']
        : ['--frozen-lockfile']),
    ]);
    await writeFile(markerFile, JSON.stringify(expectedMarker, null, 2) + '\n');
  }
  assert.equal(
    sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
    rootLockBefore,
    'Reference lockfile must remain unchanged',
  );
  assert.equal(
    await realpath(join(root, 'node_modules/typescript')),
    rootCompilerBefore,
    'Reference compiler must remain unchanged',
  );

  const installed = {};
  for (const name of Object.keys(artifacts)) {
    const packageRoot = await realpath(join(app, 'node_modules', name));
    const packageFile = join(packageRoot, 'package.json');
    const pkg = await json(packageFile);
    assert.equal(pkg.name, name);
    // Verify every distributed file against the chosen tarball, including the binary.
    const archive = artifacts[name].file;
    const listing = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
      .trim()
      .split('\n');
    for (const file of listing)
      assert.ok(
        file.startsWith('package/') && !file.split('/').includes('..'),
        `Unsafe package entry: ${file}`,
      );
    for (const line of execFileSync('tar', ['-tvzf', archive], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n'))
      assert.match(line, /^[-d]/, 'Expected regular package files/directories');
    const staging = await mkdtemp(join(tmpdir(), 'typers-app-package-'));
    const files = [];
    try {
      execFileSync('tar', [
        '-xzf',
        archive,
        '-C',
        staging,
        '--strip-components=1',
      ]);
      async function verify(directory, prefix = '') {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const file = join(directory, entry.name);
          const name = join(prefix, entry.name);
          if (entry.isDirectory()) await verify(file, name);
          else {
            const hash = sha256(await readFile(file));
            assert.equal(
              sha256(await readFile(join(packageRoot, name))),
              hash,
              `Installed artifact differs: ${name}; run pnpm typers:refresh`,
            );
            files.push({ file: name, sha256: hash });
          }
        }
      }
      await verify(staging);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    installed[name] = {
      version: pkg.version,
      packageFile,
      verifiedFiles: files.sort((a, b) => a.file.localeCompare(b.file)),
    };
  }
  const compilerRoot = dirname(installed['@typers/compiler'].packageFile);
  const compiler = join(compilerRoot, 'bin/typers.cjs');
  const adapter = join(
    dirname(installed['@typers/nest'].packageFile),
    'bin/typers-nest.mjs',
  );
  const compilerBuild = await json(join(compilerRoot, 'build-info.json'));
  assert.equal(compilerBuild.platform, process.platform);
  assert.equal(compilerBuild.arch, process.arch);
  console.log(
    `Typers app: native ${compilerBuild.version}, source ${compilerBuild.sourceCommit}; http://127.0.0.1:${process.env.PORT ?? 3014}/docs`,
  );

  if (action === 'refresh') {
    console.log('Typers app packages and lockfile refreshed.');
  } else if (action === 'typecheck') {
    await execute(process.execPath, [
      compiler,
      '-p',
      'tsconfig.json',
      '--noEmit',
      '--pretty',
      'false',
    ]);
  } else {
    // @typers/nest invokes the installed native compiler and copies real app assets.
    await execute(process.execPath, [
      adapter,
      'build',
      '--compiler',
      '@typers/compiler',
      '--json',
    ]);
    await mkdir(join(app, 'reports'), { recursive: true });
    const sourceHashes = [];
    async function hashSources(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) await hashSources(file);
        else
          sourceHashes.push({
            file: file.slice(app.length + 1),
            sha256: sha256(await readFile(file)),
          });
      }
    }
    await hashSources(join(app, 'src'));
    await writeFile(
      join(app, 'reports/build.json'),
      JSON.stringify(
        {
          builtAt: new Date().toISOString(),
          compilerBuild,
          installed,
          artifacts,
          sources: sourceHashes.sort((a, b) => a.file.localeCompare(b.file)),
          referencePreserved: true,
        },
        null,
        2,
      ) + '\n',
    );
    if (action === 'test') {
      const files = (await readdir(join(app, 'test')))
        .filter((name) => name.endsWith('.test.mjs'))
        .sort();
      assert.ok(files.length > 0, 'No application tests found');
      await execute(process.execPath, [
        '--test',
        ...files.map((file) => join('test', file)),
      ]);
    } else if (action === 'start')
      await execute(process.execPath, ['--enable-source-maps', 'dist/main.js']);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
