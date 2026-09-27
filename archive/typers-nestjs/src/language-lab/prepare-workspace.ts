import { cp, mkdtemp, readdir, rename, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

/** Materialize independent compiler settings without changing legacy Nest decorators. */
export async function prepareLanguageWorkspace(projectRoot = process.cwd()) {
  const directory = await mkdtemp(join(tmpdir(), 'typers-language-'));
  try {
    await cp(join(projectRoot, 'src/language-lab/fixtures'), directory, {
      recursive: true,
    });
    await cp(
      join(projectRoot, '.oxlintrc.json'),
      join(directory, '.oxlintrc.json'),
    );
    async function materialize(current: string): Promise<void> {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) await materialize(path);
        else if (entry.name.endsWith('.template'))
          await rename(path, path.slice(0, -'.template'.length));
      }
    }
    await materialize(directory);
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
  const workspace = await prepareLanguageWorkspace();
  console.log(`cd ${workspace.directory}`);
  for (const profile of ['core', 'decorators', 'report', 'contracts'])
    console.log(
      `node node_modules/typescript/bin/tsc -p tsconfig.${profile}.json`,
    );
  for (const entry of [
    'core/events.main',
    'core/mixins.main',
    'core/imports.main',
    'decorators/main',
    'report/main',
    'resources/main',
  ])
    console.log(`node dist/${entry}.js`);
  console.log(`Cleanup after review: rm -rf ${workspace.directory}`);
}
