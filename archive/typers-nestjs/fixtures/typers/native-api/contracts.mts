// Compiled with Typers itself against the installed native API declarations.
import { API } from '@typers/compiler/unstable/sync';
import { API as AsyncAPI } from '@typers/compiler/unstable/async';
import { SyntaxKind, type Node } from '@typers/compiler/unstable/ast';
import { createKeywordTypeNode } from '@typers/compiler/unstable/ast/factory';
import {
  createVirtualFileSystem,
  type FileSystem,
} from '@typers/compiler/unstable/fs';
import {
  resolveDocumentURI,
  type DocumentIdentifier,
} from '@typers/compiler/unstable/proto';

declare const sync: API;
declare const async: AsyncAPI;
const config: DocumentIdentifier = './tsconfig.json';
const fs: FileSystem = createVirtualFileSystem({
  '/virtual/budget.ts': 'export const budget = 1200;',
});
const node: Node = createKeywordTypeNode(SyntaxKind.NumberKeyword);

const project = sync
  .updateSnapshot({ openProjects: [config] })
  .getProject('./tsconfig.json');
const printed: string | undefined = project?.emitter.printNode(node);
const skipped: boolean | undefined = project?.typersEmitProject().emitSkipped;
const configs: readonly string[] | undefined =
  project?.typersEmitProject().configFileNames;
const asynchronousSnapshot = await async.updateSnapshot({
  openProjects: [config],
});
const asynchronousProject = asynchronousSnapshot.getProject('./tsconfig.json');
const asynchronousEmission =
  asynchronousProject && (await asynchronousProject.typersEmitProject());
const outputs: readonly { fileName: string; text: string }[] | undefined =
  asynchronousEmission?.outputs;

// @ts-expect-error The native API does not expose the legacy createProgram facade.
sync.createProgram([], {});
// @ts-expect-error Native project emission returns captured text, not a writeFile callback API.
project?.typersEmitProject({ writeFile() {} });
// @ts-expect-error Async emission is a Promise until awaited.
const wrong: boolean = asynchronousProject!.typersEmitProject().emitSkipped;
void [
  fs,
  printed,
  skipped,
  configs,
  outputs,
  wrong,
  resolveDocumentURI(config),
];
