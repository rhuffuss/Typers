import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Staging the independent workspace prevents its aliases affecting the root project. */
export async function prepareRspackWorkspace(projectRoot = process.cwd()) {
  const directory = await mkdtemp(join(tmpdir(), 'typers-rspack-'));
  const source = join(projectRoot, 'src/tooling-lab/rspack-template');
  async function copyTemplates(current: string, destination: string) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isDirectory())
        await copyTemplates(
          join(current, entry.name),
          join(destination, entry.name),
        );
      else
        await writeFile(
          join(destination, entry.name.replace(/\.template$/, '')),
          await readFile(join(current, entry.name)),
        );
    }
  }
  try {
    await copyTemplates(source, directory);
    for (const file of [
      'nest-cli.rspack.json',
      'tsconfig.rspack.json',
      'rspack.config.mjs',
    ])
      await cp(join(projectRoot, file), join(directory, file));
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'typers-rspack-lab',
        private: true,
        type: 'module',
      }),
    );
    await symlink(
      join(projectRoot, 'node_modules'),
      join(directory, 'node_modules'),
      'dir',
    );
    return {
      directory,
      close: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  // Source invocation uses Node's standard TypeScript stripping (no decorators here).
  const arguments_ = process.argv.slice(2);
  const rootArgument = arguments_.find((argument) => argument !== '--build');
  const projectRoot = rootArgument ? resolve(rootArgument) : process.cwd();
  const workspace = await prepareRspackWorkspace(projectRoot);
  if (arguments_.includes('--build')) {
    const execute = promisify(execFile);
    const run = (args: string[]) =>
      execute(process.execPath, args, {
        cwd: workspace.directory,
        timeout: 45000,
        maxBuffer: 2_000_000,
      });
    try {
      await run([
        join(projectRoot, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '-p',
        'tsconfig.rspack.json',
      ]);
      for (const name of ['api', 'worker']) {
        const result = await run([
          join(projectRoot, 'node_modules/@nestjs/cli/bin/nest.js'),
          'build',
          name,
          '--config',
          'nest-cli.rspack.json',
        ]);
        process.stdout.write(result.stdout + result.stderr);
      }
    } catch (error) {
      await workspace.close();
      throw error;
    }
  }
  console.log(workspace.directory);
  console.log(`cd ${workspace.directory}`);
  console.log(
    `node ${join(projectRoot, 'node_modules/@nestjs/cli/bin/nest.js')} build api --config nest-cli.rspack.json`,
  );
  console.log(
    `node ${join(workspace.directory, 'dist-tooling-rspack/apps/api/main.js')}`,
  );
  console.log(`Cleanup: rm -rf ${workspace.directory}`);
}
