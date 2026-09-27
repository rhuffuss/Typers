import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { API as SyncAPI, SignatureKind } from '@typers/compiler/unstable/sync';
import { API as AsyncAPI } from '@typers/compiler/unstable/async';
import { createVirtualFileSystem } from '@typers/compiler/unstable/fs';
import {
  resolveDocumentURI,
  resolveFileName,
} from '@typers/compiler/unstable/proto';
import { SyntaxKind } from '@typers/compiler/unstable/ast';
import {
  isIdentifier,
  isVariableStatement,
} from '@typers/compiler/unstable/ast/is';
import {
  createKeywordTypeNode,
  createUnionTypeNode,
} from '@typers/compiler/unstable/ast/factory';
import { formatSyntaxKind } from '@typers/compiler/unstable/ast/utils';
import { createScanner } from '@typers/compiler/unstable/ast/scanner';
import { visitEachChild } from '@typers/compiler/unstable/ast/visitor';
import { getSynthesizedDeepClone } from '@typers/compiler/unstable/ast/clone';

const root = path.dirname(fileURLToPath(import.meta.url));
const local = (name) => path.join(root, name);
const require = createRequire(import.meta.url);
const routes = [
  'sync',
  'async',
  'fs',
  'proto',
  'ast',
  'ast/is',
  'ast/factory',
  'ast/utils',
  'ast/scanner',
  'ast/visitor',
  'ast/clone',
];

function output(result, basename) {
  const item = result.outputs.find(
    (item) => path.basename(item.fileName) === basename,
  );
  assert.ok(item, `Missing captured output: ${basename}`);
  return item.text;
}

async function evaluate(text) {
  // These examples have no relative imports. Node executes precisely the JS returned by Go.
  return import(
    `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
  );
}

function summarizeEmission(result) {
  return {
    emitSkipped: result.emitSkipped,
    diagnostics: result.diagnostics.map(
      ({ code, category, text, fileName, pos, end }) => ({
        code,
        category,
        text,
        fileName: fileName && path.relative(root, fileName),
        pos,
        end,
      }),
    ),
    configFileNames: result.configFileNames.map((name) =>
      path.relative(root, name),
    ),
    outputs: result.outputs.map(({ fileName, text }) => ({
      fileName: path.relative(root, fileName),
      bytes: Buffer.byteLength(text),
      sha256: createHash('sha256').update(text).digest('hex'),
    })),
  };
}

function assertNoOutputsWritten() {
  assert.equal(
    existsSync(local('captured-output')),
    false,
    'Native API must not write output directories',
  );
  assert.equal(existsSync(local('reference/captured-output')), false);
  assert.equal(existsSync(local('tsconfig.incremental.tsbuildinfo')), false);
}

async function emitConfig(api, name, assertion) {
  const configFile = local(name);
  const snapshot = await api.updateSnapshot({ openProjects: [configFile] });
  try {
    const project = snapshot.getProject(configFile);
    assert.ok(project, `Project did not open: ${name}`);
    const result = await project.typersEmitProject();
    await assertion(result);
    assertNoOutputsWritten();
    return summarizeEmission(result);
  } finally {
    await snapshot.dispose();
  }
}

/** Runs identical behavioral contracts on the actual sync and async clients. */
async function inspectClient(mode, API) {
  // No tsserverPath: the installed client must resolve its own installed native binary.
  const api = new API({ cwd: root, collectTiming: true });
  const checks = [];
  try {
    const parsedRequest = api.parseConfigFile(local('tsconfig.json'));
    assert.equal(parsedRequest instanceof Promise, mode === 'async');
    const config = await parsedRequest;
    assert.deepEqual(config.fileNames.slice().sort(), [
      local('src/budget.ts'),
      local('src/capacity.ts'),
    ]);
    checks.push('configuration-and-client-return-shape');

    const snapshot = await api.updateSnapshot({
      openProjects: [local('tsconfig.json')],
    });
    let main;
    let queries;
    let printer;
    try {
      const project = snapshot.getProject(local('tsconfig.json'));
      assert.ok(project);
      assert.ok(snapshot.getProjects().includes(project));
      assert.equal(snapshot.getProject(local('missing.json')), undefined);
      assert.deepEqual(await project.program.getProgramDiagnostics(), []);
      assert.deepEqual(await project.program.getSyntacticDiagnostics(), []);
      assert.deepEqual(await project.program.getSemanticDiagnostics(), []);
      checks.push('project-syntax-semantic-diagnostics');

      const budgetFile = local('src/budget.ts');
      // The same source can be requested through a path or a file URI identifier.
      const document = { uri: resolveDocumentURI(budgetFile) };
      assert.equal(resolveFileName(document), budgetFile);
      const source = await project.program.getSourceFile(document);
      assert.ok(source);
      assert.equal(source.text, readFileSync(budgetFile, 'utf8'));
      assert.equal(formatSyntaxKind(source.kind), 'SourceFile');
      assert.ok(isVariableStatement(source.statements[0]));
      const declaration = source.statements[0].declarationList.declarations[0];
      assert.ok(isIdentifier(declaration.name));
      assert.equal(declaration.name.getText(), 'maximumBudget');
      const type = await project.checker.getTypeAtLocation(declaration.name);
      assert.equal(await project.checker.typeToString(type), 'number');
      const symbol = await project.checker.getSymbolAtLocation(
        declaration.name,
      );
      assert.equal(symbol?.name, 'maximumBudget');
      const references = await project.checker.getReferencesToSymbolInFile(
        budgetFile,
        symbol,
      );
      assert.ok(
        references.length >= 2,
        'The budget limit is used by both acceptance and remaining-balance rules',
      );
      for (const handle of references) {
        assert.equal(
          (await handle.resolve(project)).getText(),
          'maximumBudget',
        );
      }
      const functionNode = source.statements.find(
        (node) => node.kind === SyntaxKind.FunctionDeclaration,
      );
      const functionType = await project.checker.getTypeAtLocation(
        functionNode.name,
      );
      const signatures = await project.checker.getSignaturesOfType(
        functionType,
        SignatureKind.Call,
      );
      assert.equal(signatures.length, 1);
      assert.deepEqual(
        (await signatures[0].getParameters()).map(
          (parameter) => parameter.name,
        ),
        ['amount'],
      );
      const returnType = await project.checker.getReturnTypeOfSignature(
        signatures[0],
      );
      assert.equal(
        await project.checker.typeToString(returnType),
        'Allocation',
      );
      const completions = await project.checker.getCompletionsAtPosition(
        budgetFile,
        source.text.indexOf('Number.') + 'Number.'.length,
      );
      assert.ok(
        completions?.entries.some((entry) => entry.name === 'isSafeInteger'),
      );
      // A separate negative probe preserves the current global auto-import limitation.
      let globalCompletionRejection;
      try {
        await project.checker.getCompletionsAtPosition(
          budgetFile,
          source.text.length,
        );
      } catch (error) {
        assert.match(error.message, /completion list needs auto imports/);
        globalCompletionRejection = error.message;
      }
      assert.ok(
        globalCompletionRejection,
        'The recorded unsupported global completion scenario changed',
      );
      queries = {
        symbol: symbol.name,
        type: 'number',
        referenceCount: references.length,
        functionParameter: 'amount',
        functionReturn: 'Allocation',
        completion: 'Number.isSafeInteger',
        globalCompletionRejection,
      };
      checks.push('source-ast-symbol-type-signature-references-completions');

      // Node factory, local visitor and clone feed the native printer; they are not emit plugins.
      const union = createUnionTypeNode([
        createKeywordTypeNode(SyntaxKind.StringKeyword),
        createKeywordTypeNode(SyntaxKind.NumberKeyword),
      ]);
      const transformed = visitEachChild(union, (node) =>
        node.kind === SyntaxKind.NumberKeyword
          ? createKeywordTypeNode(SyntaxKind.BooleanKeyword)
          : node,
      );
      const clone = getSynthesizedDeepClone(transformed);
      assert.notEqual(clone, transformed);
      assert.equal(await project.emitter.printNode(union), 'string | number');
      assert.equal(
        await project.emitter.printNode(transformed),
        'string | boolean',
      );
      assert.equal(await project.emitter.printNode(clone), 'string | boolean');
      printer = {
        original: 'string | number',
        visited: 'string | boolean',
        cloned: 'string | boolean',
      };
      checks.push('factory-visitor-clone-native-printer');

      const emissionRequest = project.typersEmitProject();
      assert.equal(emissionRequest instanceof Promise, mode === 'async');
      const result = await emissionRequest;
      assert.equal(result.emitSkipped, false);
      assert.deepEqual(result.diagnostics, []);
      assert.deepEqual(
        result.configFileNames,
        [local('tsconfig.base.json'), local('tsconfig.json')].sort(),
      );
      assert.deepEqual(
        result.outputs.map(({ fileName }) => fileName),
        result.outputs.map(({ fileName }) => fileName).sort(),
      );
      assert.equal(
        result.outputs.length,
        8,
        'Two modules × JS, JS map, declaration, declaration map',
      );
      const budget = await evaluate(output(result, 'budget.js'));
      assert.deepEqual(budget.allocateBudget(200), {
        kind: 'accepted',
        remaining: 1000,
      });
      assert.deepEqual(budget.allocateBudget(1300), {
        kind: 'rejected',
        reason: 'over-budget',
      });
      assert.deepEqual(budget.allocateBudget(-1), {
        kind: 'rejected',
        reason: 'invalid-amount',
      });
      const capacityJs = output(result, 'capacity.js');
      assert.doesNotMatch(capacityJs, /if\s+let\s+Some/);
      const capacity = await evaluate(capacityJs);
      assert.equal(capacity.chooseCapacity({ kind: 'some', value: 8 }), 8);
      assert.equal(capacity.chooseCapacity({ kind: 'none' }), 0);
      assert.match(
        output(result, 'budget.d.ts'),
        /allocateBudget\(amount: number\): Allocation/,
      );
      assert.ok(
        JSON.parse(output(result, 'budget.js.map')).sources.some((name) =>
          name.endsWith('budget.ts'),
        ),
      );
      assert.ok(
        JSON.parse(output(result, 'budget.d.ts.map')).sources.some((name) =>
          name.endsWith('budget.ts'),
        ),
      );
      assertNoOutputsWritten();
      main = summarizeEmission(result);
      main.capturedExamples = {
        budgetJavaScript: output(result, 'budget.js'),
        budgetDeclaration: output(result, 'budget.d.ts'),
        budgetSourceMap: JSON.parse(output(result, 'budget.js.map')),
        budgetDeclarationMap: JSON.parse(output(result, 'budget.d.ts.map')),
        capacityJavaScript: capacityJs,
      };
      checks.push(
        'captured-js-declarations-maps-config-chain-no-writes',
        'node-budget-success-error-validation',
        'node-if-let-present-absent',
      );
    } finally {
      await snapshot.dispose();
    }
    assert.equal(snapshot.isDisposed(), true);
    assert.throws(() => snapshot.getProjects(), /disposed/);
    checks.push('snapshot-disposal');

    const noEmit = await emitConfig(api, 'tsconfig.no-emit.json', (result) => {
      assert.equal(result.emitSkipped, true);
      assert.deepEqual(result.outputs, []);
      assert.deepEqual(result.diagnostics, []);
      assert.ok(
        result.configFileNames.includes(local('tsconfig.no-emit.json')),
      );
    });
    const errors = await emitConfig(api, 'tsconfig.errors.json', (result) => {
      assert.equal(result.emitSkipped, false);
      assert.ok(result.outputs.length > 0);
      assert.deepEqual(
        result.diagnostics.map(({ code }) => code),
        [2322],
      );
    });
    const blocked = await emitConfig(api, 'tsconfig.blocked.json', (result) => {
      assert.equal(result.emitSkipped, true);
      assert.deepEqual(result.outputs, []);
      assert.deepEqual(
        result.diagnostics.map(({ code }) => code),
        [2322],
      );
      assert.equal(result.configFileNames.length, 4);
    });
    const declarations = await emitConfig(
      api,
      'tsconfig.declarations.json',
      (result) => {
        assert.equal(result.emitSkipped, false);
        assert.deepEqual(result.diagnostics, []);
        assert.equal(result.outputs.length, 4);
        assert.ok(
          result.outputs.every(({ fileName }) =>
            /\.d\.ts(?:\.map)?$/.test(fileName),
          ),
        );
      },
    );
    checks.push(
      'noEmit',
      'errors-with-output',
      'noEmitOnError',
      'declaration-only',
    );

    const rejections = [];
    for (const feature of ['incremental', 'composite', 'references']) {
      const configFile = local(`tsconfig.${feature}.json`);
      const rejectedSnapshot = await api.updateSnapshot({
        openProjects: [configFile],
      });
      try {
        const project = rejectedSnapshot.getProject(configFile);
        assert.ok(project);
        let rejected = false;
        try {
          await project.typersEmitProject();
        } catch (error) {
          assert.match(
            error.message,
            /does not support incremental, composite, or project references/,
          );
          rejections.push({ feature, message: error.message });
          rejected = true;
        }
        assert.equal(
          rejected,
          true,
          `${feature} must reject rather than return a successful emission`,
        );
        assertNoOutputsWritten();
      } finally {
        await rejectedSnapshot.dispose();
      }
    }
    checks.push('reject-incremental', 'reject-composite', 'reject-references');

    const timing = await api.getTimingInfo();
    assert.equal(timing.enabled, true);
    assert.ok(timing.totals.requestCount > 0);
    assert.ok(timing.totals.bytesReceived > 0);
    await api.resetTimingInfo();
    const reset = await api.getTimingInfo();
    assert.ok(reset.totals.requestCount < timing.totals.requestCount);
    api.clearSourceFileCache();
    checks.push('timing-and-reset');
    return {
      executable: 'default installed binary',
      checks,
      queries,
      printer,
      main,
      noEmit,
      errors,
      blocked,
      declarations,
      rejections,
      timing: { requestsObserved: timing.totals.requestCount, reset: true },
    };
  } finally {
    await api.close();
  }
}

async function inspectVirtualSnapshots(mode, API) {
  const budgetFile = local('src/budget.ts');
  const source = readFileSync(budgetFile, 'utf8');
  const fs = createVirtualFileSystem({ [budgetFile]: source });
  assert.equal(fs.fileExists(budgetFile), true);
  assert.equal(fs.directoryExists(path.dirname(budgetFile)), true);
  assert.ok(
    fs
      .getAccessibleEntries(path.dirname(budgetFile))
      .files.includes('budget.ts'),
  );
  // Overlay only reads; undefined falls through to disk for configs/package.json/libs.
  // The standalone VFS reports false for absent files, so delegating every callback
  // would intentionally hide real package metadata and change NodeNext module mode.
  const api = new API({ cwd: root, fs: { readFile: fs.readFile } });
  try {
    const before = await api.updateSnapshot({
      openProjects: [local('tsconfig.json')],
    });
    try {
      // Populate the retained snapshot before changing the virtual backing store.
      const oldProject = before.getProject(local('tsconfig.json'));
      const old = await oldProject.typersEmitProject();
      assert.equal(
        (await evaluate(output(old, 'budget.js'))).maximumBudget,
        1200,
      );
      fs.writeFile(budgetFile, source.replace('= 1200;', '= 1500;'));
      const after = await api.updateSnapshot({
        fileChanges: { changed: [budgetFile] },
      });
      try {
        const updated = await after
          .getProject(local('tsconfig.json'))
          .typersEmitProject();
        assert.equal(
          (await evaluate(output(updated, 'budget.js'))).maximumBudget,
          1500,
        );
        const retained = await oldProject.typersEmitProject();
        assert.equal(output(retained, 'budget.js'), output(old, 'budget.js'));
        assert.equal(
          readFileSync(budgetFile, 'utf8'),
          source,
          'Virtual changes must not affect source on disk',
        );
        assertNoOutputsWritten();
      } finally {
        await after.dispose();
      }
    } finally {
      await before.dispose();
    }
  } finally {
    await api.close();
  }
  fs.removeFile(budgetFile);
  assert.equal(fs.fileExists(budgetFile), false);
  return {
    mode,
    before: 1200,
    after: 1500,
    retainedSnapshot: 1200,
    diskSourceUnchanged: true,
  };
}

export async function runNativeApi() {
  assertNoOutputsWritten();
  const metadata = require('@typers/compiler/package.json');
  assert.equal(metadata.name, '@typers/compiler');
  const rootExports = require('@typers/compiler');
  assert.equal(rootExports.version, '7.0.2');
  assert.equal(rootExports.versionMajorMinor, '7.0');
  assert.equal(rootExports.typersVersion, metadata.version);
  assert.equal(rootExports.upstreamVersion, '7.0.2');
  const absentLegacyExports = [
    'createProgram',
    'sys',
    'getParsedCommandLineOfConfigFile',
  ];
  for (const name of absentLegacyExports) {
    assert.equal(
      name in rootExports,
      false,
      `The root package does not expose legacy ${name}`,
    );
  }
  const installedRoutes = await Promise.all(
    routes.map(async (route) => {
      const exports = await import(`@typers/compiler/unstable/${route}`);
      return {
        route: `@typers/compiler/unstable/${route}`,
        runtimeExportCount: Object.keys(exports).length,
      };
    }),
  );
  const scanner = createScanner(
    true,
    undefined,
    'const remaining: number = 1200;',
  );
  const tokens = [];
  for (
    let token = scanner.scan();
    token !== SyntaxKind.EndOfFile;
    token = scanner.scan()
  ) {
    tokens.push(formatSyntaxKind(token));
    assert.ok(
      tokens.length <= 16,
      'Scanner must reach its native EndOfFile token',
    );
  }
  assert.deepEqual(tokens, [
    'ConstKeyword',
    'Identifier',
    'ColonToken',
    'NumberKeyword',
    'EqualsToken',
    'NumericLiteral',
    'SemicolonToken',
  ]);
  const clients = {};
  const snapshots = [];
  for (const [mode, API] of [
    ['sync', SyncAPI],
    ['async', AsyncAPI],
  ]) {
    clients[mode] = await inspectClient(mode, API);
    snapshots.push(await inspectVirtualSnapshots(mode, API));
  }
  assert.deepEqual(
    clients.sync.main,
    clients.async.main,
    'Sync and async must return identical captured output',
  );
  return {
    suite: 'typers-native-api',
    status: 'passed',
    compilerVersion: metadata.version,
    rootPackage: { ...rootExports, absentLegacyExports },
    contracts:
      clients.sync.checks.length +
      clients.async.checks.length +
      snapshots.length +
      2,
    installedRoutes,
    scanner: tokens,
    clients,
    snapshots,
    limits: [
      'Representative behavioral contracts, not coverage of every upstream method or overload.',
      'All unstable/* APIs are experimental; no classic createProgram facade.',
      'AST visitor/printer are not compiler plugins; scanner tokenizes standard TypeScript here.',
      'No LSP attachment, CPU/heap profiling, concurrent snapshots or large-project memory guarantee.',
    ],
  };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  console.log(JSON.stringify(await runNativeApi(), null, 2));
}
