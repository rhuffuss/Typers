import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareRspackWorkspace } from '../src/tooling-lab/prepare-workspace.js';

const execute = promisify(execFile);
const projectRoot = process.cwd();
const nest = join(projectRoot, 'node_modules/@nestjs/cli/bin/nest.js');
const tsc = join(projectRoot, 'node_modules/typescript/bin/tsc');
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const run = (args: string[], cwd = projectRoot, timeout = 45000) =>
  execute(process.execPath, args, {
    cwd,
    timeout,
    env: { ...process.env, DEMO_DATABASE: 'memory', FORCE_COLOR: '0' },
    maxBuffer: 2_000_000,
  });

function start(args: string[], cwd = projectRoot) {
  const child = spawn(process.execPath, args, {
    cwd,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DEMO_DATABASE: 'memory',
      PORT: '0',
      FORCE_COLOR: '0',
    },
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  const closed = new Promise<void>((resolve) => {
    child.once('close', () => resolve());
  });
  return { child, output: () => output, closed };
}

async function stop(managed: ReturnType<typeof start>) {
  if (managed.child.exitCode !== null || managed.child.signalCode !== null)
    return;
  const signal = (name: NodeJS.Signals) => {
    try {
      if (process.platform === 'win32') managed.child.kill(name);
      else if (managed.child.pid) process.kill(-managed.child.pid, name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  signal('SIGTERM');
  await Promise.race([managed.closed, pause(2500)]);
  if (managed.child.exitCode === null && managed.child.signalCode === null) {
    signal('SIGKILL');
    await managed.closed;
  }
}

interface ToolingResponse {
  builder: string;
  message: string;
  dependencies: string[];
}
async function waitForHttp(
  managed: ReturnType<typeof start>,
  matches: (data: ToolingResponse) => boolean,
  timeout = 15000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (managed.child.exitCode !== null || managed.child.signalCode !== null)
      throw new Error('Server exited:\n' + managed.output());
    const urls = [
      ...managed.output().matchAll(/TOOLING_URL=(http:\/\/[^\s]+)/g),
    ].map((match) => match[1]);
    for (const url of urls.reverse()) {
      try {
        const response = await fetch(url + '/tooling', {
          signal: AbortSignal.timeout(500),
        });
        const body = (await response.json()) as ToolingResponse;
        if (matches(body)) return { url, body };
      } catch {
        /* The compiler may still be starting/restarting the child. */
      }
    }
    await pause(50);
  }
  throw new Error('Timed out waiting for HTTP contract:\n' + managed.output());
}

describe('Official Nest tooling pipelines', () => {
  it('compiles ESM with SWC and injects constructor metadata into a real HTTP controller', async () => {
    const build = await run([nest, 'build', '--config', 'nest-cli.swc.json']);
    expect(build.stdout + build.stderr).toContain('Successfully compiled');
    const emitted = await readFile(
      'dist-tooling-swc/src/tooling-lab/swc-only/tooling.module.js',
      'utf8',
    );
    expect(emitted).toContain('design:paramtypes');
    expect(emitted).toContain("from './message.service.js'");
    const server = start(['dist-tooling-swc/src/tooling-lab/swc-only/main.js']);
    try {
      const { body } = await waitForHttp(
        server,
        (data) => data.message === 'swc-initial',
      );
      expect(body).toEqual({
        builder: 'swc',
        message: 'swc-initial',
        dependencies: ['BuildMessageService'],
      });
    } finally {
      await stop(server);
    }
  }, 55000);

  it('builds two real Rspack workspace projects sharing a path-mapped Nest library', async () => {
    const workspace = await prepareRspackWorkspace();
    try {
      // Rspack transpilation and TypeScript checking are separate contracts.
      await run(
        [tsc, '--noEmit', '-p', 'tsconfig.rspack.json'],
        workspace.directory,
      );
      await run(
        [nest, 'build', 'api', '--config', 'nest-cli.rspack.json'],
        workspace.directory,
      );
      const server = start(
        ['dist-tooling-rspack/apps/api/main.js'],
        workspace.directory,
      );
      try {
        const { body } = await waitForHttp(
          server,
          (data) => data.message === 'rspack-shared-library',
        );
        expect(body).toEqual({
          builder: 'rspack',
          message: 'rspack-shared-library',
          dependencies: ['SharedBuildService'],
        });
      } finally {
        await stop(server);
      }
      await run(
        [nest, 'build', 'worker', '--config', 'nest-cli.rspack.json'],
        workspace.directory,
      );
      const worker = await run(
        ['dist-tooling-rspack/apps/worker/main.js'],
        workspace.directory,
      );
      expect(JSON.parse(worker.stdout.trim())).toEqual({
        kind: 'rspack-worker',
        message: 'rspack-shared-library',
      });
    } finally {
      await workspace.close();
    }
  }, 60000);

  it('uses official module, provider and REST resource schematics and runs their CRUD routes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'typers-nest-generate-'));
    try {
      await mkdir(join(directory, 'src'));
      await symlink(
        join(projectRoot, 'node_modules'),
        join(directory, 'node_modules'),
        'dir',
      );
      await writeFile(
        join(directory, 'package.json'),
        JSON.stringify({
          name: 'generated-lab',
          private: true,
          type: 'module',
          dependencies: { '@nestjs/mapped-types': '*' },
        }),
      );
      await writeFile(
        join(directory, 'nest-cli.json'),
        JSON.stringify({
          collection: '@nestjs/schematics',
          sourceRoot: 'src',
          compilerOptions: { tsConfigPath: 'tsconfig.json' },
        }),
      );
      const config = JSON.parse(
        await readFile(join(projectRoot, 'tsconfig.json'), 'utf8'),
      );
      config.compilerOptions.rootDir = 'src';
      config.compilerOptions.types = ['node'];
      config.compilerOptions.outDir = 'dist';
      config.include = ['src/**/*.ts'];
      config.exclude = ['node_modules', 'dist'];
      await writeFile(join(directory, 'tsconfig.json'), JSON.stringify(config));
      await writeFile(
        join(directory, 'src/app.module.ts'),
        "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
      );
      await run(
        [nest, 'generate', 'module', 'generated', '--no-spec'],
        directory,
      );
      await run(
        [nest, 'generate', 'provider', 'generated/registry', '--no-spec'],
        directory,
      );
      await run(
        [
          nest,
          'generate',
          'resource',
          'notes',
          '--type',
          'rest',
          '--crud',
          'true',
          '--no-spec',
        ],
        directory,
      );
      await writeFile(
        join(directory, 'src/main.ts'),
        `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
const app = await NestFactory.create(AppModule, { logger: false });
app.enableShutdownHooks();
await app.listen(0, '127.0.0.1');
console.log('TOOLING_URL=' + await app.getUrl());
`,
      );
      await run([nest, 'build'], directory);
      const server = start(['dist/main.js'], directory);
      try {
        let url: string | undefined;
        const deadline = Date.now() + 15000;
        while (!url && Date.now() < deadline) {
          url = server.output().match(/TOOLING_URL=(http:\/\/[^\s]+)/)?.[1];
          if (!url) await pause(50);
        }
        if (!url) throw new Error(server.output());
        expect(await (await fetch(url + '/notes')).text()).toBe(
          'This action returns all notes',
        );
        const created = await fetch(url + '/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        expect(created.status).toBe(201);
        expect(await created.text()).toBe('This action adds a new note');
        expect(await (await fetch(url + '/notes/7')).text()).toBe(
          'This action returns a #7 note',
        );
      } finally {
        await stop(server);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60000);

  it('rebuilds and restarts the SWC HTTP process after a source edit in a temporary workspace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'typers-nest-watch-'));
    let server: ReturnType<typeof start> | undefined;
    try {
      await cp(
        join(projectRoot, 'src/tooling-lab/swc-only'),
        join(directory, 'src/tooling-lab/swc-only'),
        { recursive: true },
      );
      for (const file of [
        'nest-cli.swc.json',
        'tsconfig.swc.json',
        'tsconfig.json',
        '.swcrc',
      ])
        await cp(join(projectRoot, file), join(directory, file));
      await writeFile(
        join(directory, 'package.json'),
        JSON.stringify({ type: 'module', private: true }),
      );
      await symlink(
        join(projectRoot, 'node_modules'),
        join(directory, 'node_modules'),
        'dir',
      );
      server = start(
        [nest, 'start', '--config', 'nest-cli.swc.json', '--watch'],
        directory,
      );
      expect(
        (await waitForHttp(server, (data) => data.message === 'swc-initial'))
          .body.dependencies,
      ).toEqual(['BuildMessageService']);
      const sourcePath = join(
        directory,
        'src/tooling-lab/swc-only/message.service.ts',
      );
      await writeFile(
        sourcePath,
        (await readFile(sourcePath, 'utf8')).replace(
          'swc-initial',
          'swc-rebuilt',
        ),
      );
      const updated = await waitForHttp(
        server,
        (data) => data.message === 'swc-rebuilt',
        20000,
      );
      expect(updated.body.dependencies).toEqual(['BuildMessageService']);
    } finally {
      if (server) await stop(server);
      await rm(directory, { recursive: true, force: true });
    }
  }, 60000);
});

describe('Standalone application entrypoints in emitted JavaScript', () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'typers-standalone-emitted-'));
    await symlink(
      join(projectRoot, 'node_modules'),
      join(directory, 'node_modules'),
      'dir',
    );
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ type: 'module', private: true }),
    );
    const config = JSON.parse(
      await readFile(join(projectRoot, 'tsconfig.json'), 'utf8'),
    );
    config.compilerOptions.rootDir = join(projectRoot, 'src');
    config.compilerOptions.outDir = 'dist';
    config.compilerOptions.tsBuildInfoFile = join(
      directory,
      'tsconfig.tsbuildinfo',
    );
    config.compilerOptions.types = ['node', 'express-session', 'multer'];
    config.compilerOptions.declaration = false;
    config.include = [join(projectRoot, 'src/standalone/*.ts')];
    config.exclude = [];
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify(config));
    await run([tsc, '-p', 'tsconfig.json'], directory);
  }, 45000);

  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('resolves providers in an application context and closes without an HTTP server', async () => {
    const result = await run(['dist/standalone/main.js'], directory, 10000);
    const body = JSON.parse(result.stdout);
    expect(body.kind).toBe('standalone');
    expect(body.projects.items[0].slug).toBe('typers-playground');
  });

  it('parses a Commander option and runs a Nest-injected command', async () => {
    const result = await run(
      ['dist/standalone/main.commander.js', 'projects', '--limit', '1'],
      directory,
      10000,
    );
    const body = JSON.parse(result.stdout);
    expect(body.limit).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe('typers-playground');
  });

  it('resolves an exported provider through the real Nest REPL and exits cleanly', async () => {
    const repl = start(['dist/standalone/main.repl.js'], directory);
    try {
      repl.child.stdin.end(
        'get(WorkspacesService).constructor.name\nawait get(WorkspacesService).listProjects({ page: 1, limit: 1 })\n.exit\n',
      );
      const completed = await Promise.race([
        repl.closed.then(() => true),
        pause(10000).then(() => false),
      ]);
      if (!completed) throw new Error('REPL did not close:\n' + repl.output());
      expect(repl.child.exitCode).toBe(0);
      expect(repl.output()).toContain("'WorkspacesService'");
      expect(repl.output()).toContain("slug: 'typers-playground'");
    } finally {
      await stop(repl);
    }
  }, 15000);
});
