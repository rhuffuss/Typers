import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export const readJson = async (file) =>
  JSON.parse(await readFile(file, 'utf8'));
export async function manifest(directory) {
  const entries = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = join(current, entry.name);
      assert.ok(
        !entry.isSymbolicLink(),
        `Unexpected link in snapshot: ${file}`,
      );
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile())
        entries.push({
          path: relative(directory, file),
          sha256: sha256(await readFile(file)),
        });
    }
  }
  await visit(directory);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { sha256: sha256(JSON.stringify(entries)), entries };
}

export async function createLab(root, artifacts) {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'typers-features-')),
  );
  await mkdir(join(directory, 'logs'));
  await mkdir(join(directory, 'artifacts'));
  const referenceTs = await realpath(join(root, 'node_modules/typescript'));
  const referenceBefore = await manifest(referenceTs);
  const lockBefore = sha256(await readFile(join(root, 'pnpm-lock.yaml')));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runDirectory: directory,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    artifacts: [],
    dependencies: [],
    steps: [],
    isolation:
      'Copied fixtures and explicit local tarballs. Locked reference dependencies linked per package; no install, network, source transformer or compiler fallback. Emitted programs run with Node.',
  };
  async function step(
    id,
    cwd,
    executable,
    args,
    expectedDiagnostic,
    expectedExitCode = 1,
  ) {
    let stdout = '',
      stderr = '',
      timedOut = false;
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DEMO_DATABASE: 'memory',
      NO_COLOR: '1',
    };
    for (const key of Object.keys(env))
      if (key.startsWith('OBSERVE_')) delete env[key];
    const start = Date.now();
    const child = spawn(executable, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    let forceTimer;
    const kill = (signal) => {
      try {
        if (process.platform === 'win32') child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') stderr += error.message;
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill('SIGTERM');
      forceTimer = setTimeout(() => kill('SIGKILL'), 2000);
    }, 120_000);
    const outcome = await new Promise((resolveStep) => {
      child.once('error', (error) => {
        stderr += error.message;
      });
      child.once('close', (exitCode, signal) =>
        resolveStep({ exitCode, signal }),
      );
    });
    clearTimeout(timer);
    clearTimeout(forceTimer);
    const result = {
      id,
      cwd: relative(directory, cwd),
      command: [executable === process.execPath ? 'node' : executable, ...args],
      ...outcome,
      status: timedOut
        ? 'timeout'
        : outcome.exitCode === 0
          ? 'passed'
          : 'failed',
      expectedRejection: Boolean(expectedDiagnostic),
      expectationMet:
        !timedOut &&
        (expectedDiagnostic
          ? outcome.exitCode === expectedExitCode &&
            expectedDiagnostic.test(stdout + stderr)
          : outcome.exitCode === 0),
      durationMs: Date.now() - start,
      diagnostics: [
        ...new Set(
          [
            ...`${stdout}\n${stderr}`.matchAll(/(?:error|warning) TS(\d+)/g),
          ].map((m) => Number(m[1])),
        ),
      ],
      logs: {
        stdout: `logs/${id}.stdout.log`,
        stderr: `logs/${id}.stderr.log`,
      },
      stdoutSha256: sha256(stdout),
      stderrSha256: sha256(stderr),
    };
    if (expectedDiagnostic) result.diagnosticText = (stdout + stderr).trim();
    if (stdout.startsWith('{')) {
      try {
        result.evidence = JSON.parse(stdout);
      } catch {
        /* Output remains in the log. */
      }
    }
    if (/^# tests /m.test(stdout)) {
      result.nodeTests = Object.fromEntries(
        [...stdout.matchAll(/^# (tests|pass|fail|skipped) (\d+)/gm)].map(
          (m) => [m[1], Number(m[2])],
        ),
      );
      result.testNames = [...stdout.matchAll(/^# Subtest: (.+)/gm)].map(
        (m) => m[1],
      );
    }
    await writeFile(join(directory, result.logs.stdout), stdout);
    await writeFile(join(directory, result.logs.stderr), stderr);
    report.steps.push(result);
    console.log(
      `${id}: ${result.status}${expectedDiagnostic ? ' (expected rejection)' : ''}`,
    );
    assert.ok(
      result.expectationMet,
      `${id} did not meet its expectation; ${join(directory, 'logs')}\n${(stdout + stderr).slice(-6000)}`,
    );
    return result;
  }
  const modules = join(directory, 'node_modules');
  await mkdir(modules);
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
      if (name.startsWith('@typers/')) continue;
      const target = await realpath(join(root, 'node_modules', name));
      const pkg = await readJson(join(target, 'package.json'));
      await mkdir(dirname(join(modules, name)), { recursive: true });
      await symlink(target, join(modules, name), 'dir');
      report.dependencies.push({
        name,
        version: pkg.version,
        packageJsonSha256: sha256(await readFile(join(target, 'package.json'))),
      });
    }
  }
  for (const key of ['compiler', 'core', 'nest']) {
    assert.ok(artifacts[key], `--${key} must name an explicit local tarball`);
    const source = resolve(artifacts[key]);
    const bytes = await readFile(source);
    const archive = join(directory, 'artifacts', `${key}-${sha256(bytes)}.tgz`);
    await writeFile(archive, bytes);
    const listing = await step(`list-${key}`, directory, 'tar', [
      '-tzf',
      archive,
    ]);
    for (const name of (
      await readFile(join(directory, listing.logs.stdout), 'utf8')
    )
      .trim()
      .split('\n')) {
      assert.ok(
        name.startsWith('package/') && !name.split('/').includes('..'),
        `Unexpected archive path ${name}`,
      );
    }
    const types = await step(`archive-types-${key}`, directory, 'tar', [
      '-tvzf',
      archive,
    ]);
    for (const line of (
      await readFile(join(directory, types.logs.stdout), 'utf8')
    )
      .trim()
      .split('\n')) {
      assert.match(
        line,
        /^[-d]/,
        'Archives may contain only regular files and directories',
      );
    }
    const target = join(modules, '@typers', key);
    await mkdir(target, { recursive: true });
    await step(`extract-${key}`, directory, 'tar', [
      '-xzf',
      archive,
      '-C',
      target,
      '--strip-components=1',
    ]);
    const pkg = await readJson(join(target, 'package.json'));
    assert.equal(pkg.name, `@typers/${key}`);
    report.artifacts.push({
      name: pkg.name,
      version: pkg.version,
      filename: basename(source),
      sha256: sha256(bytes),
      unpacked: await manifest(target),
    });
  }
  const nestPackage = await readJson(
    join(modules, '@typers/nest/package.json'),
  );
  const minimatchRoot = await realpath(
    join(
      root,
      'node_modules/.pnpm',
      `minimatch@${nestPackage.dependencies.minimatch}`,
      'node_modules/minimatch',
    ),
  );
  // Nest imports minimatch from its package, so give it an explicit dependency directory.
  await mkdir(join(modules, '@typers/nest/node_modules'));
  await symlink(
    minimatchRoot,
    join(modules, '@typers/nest/node_modules/minimatch'),
    'dir',
  );
  report.adapterDependency = {
    name: 'minimatch',
    version: (await readJson(join(minimatchRoot, 'package.json'))).version,
  };
  await mkdir(join(modules, '.bin'));
  const compilerPackage = await readJson(
    join(modules, '@typers/compiler/package.json'),
  );
  for (const [name, file] of Object.entries(compilerPackage.bin))
    await symlink(
      join(modules, '@typers/compiler', file),
      join(modules, '.bin', name),
    );
  report.compilerBuild = await readJson(
    join(modules, '@typers/compiler/build-info.json'),
  );
  const sourceBeforeCopy = await manifest(join(root, 'fixtures/typers'));
  report.harness = await Promise.all(
    ['demonstrate-typers.mjs', 'typers-lab-support.mjs'].map(async (file) => ({
      path: `scripts/${file}`,
      sha256: sha256(await readFile(join(root, 'scripts', file))),
    })),
  );
  await cp(join(root, 'fixtures/typers'), join(directory, 'profiles'), {
    recursive: true,
  });
  report.sources = await manifest(join(directory, 'profiles'));
  assert.equal(
    report.sources.sha256,
    sourceBeforeCopy.sha256,
    'Fixtures changed while copying; prepare a fresh snapshot',
  );
  await writeFile(
    join(directory, 'package.json'),
    '{"private":true,"type":"module"}\n',
  );
  report.reference = {
    typescript: (await readJson(join(referenceTs, 'package.json'))).version,
    typescriptSha256: referenceBefore.sha256,
    lockfileSha256: lockBefore,
  };
  async function verifyReference() {
    assert.equal((await manifest(referenceTs)).sha256, referenceBefore.sha256);
    assert.equal(
      sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
      lockBefore,
    );
    report.reference.preserved = true;
  }
  return { directory, modules, report, step, verifyReference };
}
