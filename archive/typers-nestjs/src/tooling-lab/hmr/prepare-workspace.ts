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
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

/** A dedicated CommonJS package keeps the deprecated recipe out of the ESM app. */
export async function prepareHmrWorkspace(projectRoot = process.cwd()) {
  const directory = await mkdtemp(join(tmpdir(), 'typers-webpack-hmr-'));
  try {
    const templates = join(projectRoot, 'src/tooling-lab/hmr/template');
    await mkdir(join(directory, 'src'));
    for (const name of await readdir(templates)) {
      await writeFile(
        join(directory, 'src', name.replace(/\.template$/, '')),
        await readFile(join(templates, name)),
      );
    }
    for (const file of [
      'nest-cli.hmr.json',
      'tsconfig.hmr.json',
      'webpack.hmr.cjs',
    ]) {
      await cp(join(projectRoot, file), join(directory, file));
    }
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'typers-webpack-hmr-lab',
        type: 'commonjs',
        private: true,
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
  const workspace = await prepareHmrWorkspace();
  console.log(`cd ${workspace.directory}`);
  console.log(
    'node node_modules/@nestjs/cli/bin/nest.js build --config nest-cli.hmr.json --watch',
  );
  console.log('Edit src/message.ts, then request the printed HMR_URL + /hmr.');
  console.log(
    `After stopping the watcher, cleanup: rm -rf ${workspace.directory}`,
  );
}
