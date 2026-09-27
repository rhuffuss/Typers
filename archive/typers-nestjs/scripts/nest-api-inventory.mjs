#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputJson = resolve(root, 'docs/nest-api-coverage.json');
const outputMd = resolve(root, 'docs/nest-api-coverage.md');
const evidencePath = resolve(root, 'docs/nest-api-evidence.json');
const scriptPath = fileURLToPath(import.meta.url);
const sortText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const slashes = (path) => path.split(sep).join('/');
function normalizedPath(path) {
  const normalized = slashes(path);
  const lastModules = normalized.lastIndexOf('/node_modules/');
  return lastModules >= 0
    ? 'node_modules/' + normalized.slice(lastModules + 14)
    : slashes(relative(root, path));
}
function portableText(text) {
  return text
    .replace(/import\("([^"]+)"\)/g, (match, path) =>
      path.startsWith('/') ? `import("${normalizedPath(path)}")` : match,
    )
    .replaceAll(slashes(root), '<repository>/')
    .replace(/\s+/g, ' ')
    .trim();
}
function portableCompilerOptions(value) {
  if (typeof value === 'string') {
    const path = slashes(value);
    if (path === slashes(resolve(root))) return '<repository>';
    if (path.startsWith(slashes(root)))
      return '<repository>/' + path.slice(slashes(root).length);
    return value;
  }
  if (Array.isArray(value)) return value.map(portableCompilerOptions);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        portableCompilerOptions(entry),
      ]),
    );
  return value;
}
function projectPath(path) {
  assert.equal(typeof path, 'string');
  const resolved = resolve(root, path);
  assert.ok(
    !relative(root, resolved).startsWith('..') && resolved !== root,
    `Evidence outside repository: ${path}`,
  );
  assert.ok(existsSync(resolved), `Missing evidence: ${path}`);
  return resolved;
}
function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => sortText(a.name, b.name))
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory()
        ? walk(path)
        : /\.(?:[cm]?tsx?|[cm]?tsx?\.template)$/.test(entry.name)
          ? [path]
          : [];
    });
}
function location(node) {
  const source = node.getSourceFile();
  const { line, character } = source.getLineAndCharacterOfPosition(
    node.getStart(source),
  );
  return {
    file: normalizedPath(source.fileName),
    line: line + 1,
    column: character + 1,
  };
}
function resolveAlias(checker, symbol) {
  return symbol && symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}
function publicDeclaration(declaration) {
  if (!declaration) return true;
  const modifiers = ts.getCombinedModifierFlags(declaration);
  return (
    !(modifiers & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) &&
    !(declaration.name && ts.isPrivateIdentifier(declaration.name))
  );
}
function symbolKind(symbol) {
  for (const [flag, name] of [
    [ts.SymbolFlags.Class, 'class'],
    [ts.SymbolFlags.Interface, 'interface'],
    [ts.SymbolFlags.TypeAlias, 'type-alias'],
    [ts.SymbolFlags.Enum, 'enum'],
    [ts.SymbolFlags.Function, 'function'],
    [ts.SymbolFlags.Namespace, 'namespace'],
    [ts.SymbolFlags.Variable, 'variable'],
  ]) {
    if (symbol.flags & flag) return name;
  }
  return 'other';
}
function moduleTables(checker) {
  const tables = new Map();
  return (symbol) => {
    symbol = resolveAlias(checker, symbol);
    if (!symbol) return undefined;
    if (!tables.has(symbol)) {
      const source = symbol.declarations?.find(ts.isSourceFile);
      tables.set(symbol, {
        symbol,
        source,
        exports: new Map(
          checker.getExportsOfModule(symbol).map((item) => [item.name, item]),
        ),
      });
    }
    return tables.get(symbol);
  };
}

/** Follow public export syntax, so `export type { SomeClass }` never becomes a runtime value. */
function runtimeExportResolver(checker) {
  const tableFor = moduleTables(checker);
  function localValue(symbol, visiting) {
    if (!symbol) return false;
    if (!(symbol.flags & ts.SymbolFlags.Alias))
      return Boolean(symbol.flags & ts.SymbolFlags.Value);
    for (const declaration of symbol.declarations ?? []) {
      if (ts.isImportSpecifier(declaration)) {
        const clause = declaration.parent.parent;
        if (declaration.isTypeOnly || clause.isTypeOnly) return false;
        const imported = checker.getSymbolAtLocation(
          clause.parent.moduleSpecifier,
        );
        return visit(
          imported,
          (declaration.propertyName ?? declaration.name).text,
          visiting,
        );
      }
      if (ts.isNamespaceImport(declaration))
        return !declaration.parent.isTypeOnly;
    }
    return Boolean(resolveAlias(checker, symbol)?.flags & ts.SymbolFlags.Value);
  }
  function visit(moduleSymbol, name, visiting = new Set()) {
    const table = tableFor(moduleSymbol);
    if (!table) return false;
    const target = resolveAlias(checker, table.exports.get(name));
    if (!target || !(target.flags & ts.SymbolFlags.Value)) return false;
    const key = `${table.source?.fileName ?? table.symbol.name}::${name}`;
    if (visiting.has(key)) return false;
    visiting = new Set([...visiting, key]);
    if (!table.source) return true;
    const stars = [];
    for (const statement of table.source.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue;
        const imported = statement.moduleSpecifier
          ? checker.getSymbolAtLocation(statement.moduleSpecifier)
          : undefined;
        if (!statement.exportClause) {
          if (imported) stars.push(imported);
          continue;
        }
        if (ts.isNamespaceExport(statement.exportClause)) {
          if (statement.exportClause.name.text === name) return true;
          continue;
        }
        for (const specifier of statement.exportClause.elements) {
          if (specifier.name.text !== name || specifier.isTypeOnly) continue;
          if (imported)
            return visit(
              imported,
              (specifier.propertyName ?? specifier.name).text,
              visiting,
            );
          return localValue(
            checker.getExportSpecifierLocalTargetSymbol(specifier),
            visiting,
          );
        }
      } else if (ts.isExportAssignment(statement) && name === 'default') {
        return localValue(
          checker.getSymbolAtLocation(statement.expression),
          visiting,
        );
      } else if (
        ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export
      ) {
        if (ts.isVariableStatement(statement)) {
          if (
            statement.declarationList.declarations.some(
              (declaration) =>
                ts.isIdentifier(declaration.name) &&
                declaration.name.text === name,
            )
          )
            return true;
        } else if (
          statement.name?.getText() === name ||
          (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Default &&
            name === 'default')
        ) {
          return (
            !ts.isInterfaceDeclaration(statement) &&
            !ts.isTypeAliasDeclaration(statement)
          );
        }
      }
    }
    return stars.some((symbol) => visit(symbol, name, visiting));
  }
  return visit;
}

function describeApi(
  checker,
  moduleSymbol,
  exported,
  packageName,
  hasRuntimeExport,
) {
  const target = resolveAlias(checker, exported);
  const declarations = target.declarations ?? [];
  const declaration = target.valueDeclaration ?? declarations[0];
  const kind = symbolKind(target);
  const valueType = declaration
    ? checker.getTypeOfSymbolAtLocation(target, declaration)
    : checker.getDeclaredTypeOfSymbol(target);
  const declaredType =
    target.flags & ts.SymbolFlags.Type
      ? checker.getDeclaredTypeOfSymbol(target)
      : valueType;
  const flags =
    ts.TypeFormatFlags.NoTruncation |
    ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
  const describeType = (type, node) =>
    portableText(checker.typeToString(type, node, flags));
  const signatures = (type, signatureKind) =>
    checker
      .getSignaturesOfType(type, signatureKind)
      .map((signature) =>
        portableText(checker.signatureToString(signature, declaration, flags)),
      )
      .sort(sortText);
  const api = {
    id: `${packageName}::${exported.name}`,
    name: exported.name,
    kind,
    availability: hasRuntimeExport(moduleSymbol, exported.name)
      ? 'declared-runtime-value'
      : 'type-only',
    typeText: describeType(declaredType, declaration),
    callSignatures: signatures(valueType, ts.SignatureKind.Call),
    constructSignatures: signatures(valueType, ts.SignatureKind.Construct),
    declarations: declarations
      .map((node) => ({ ...location(node), kind: ts.SyntaxKind[node.kind] }))
      .sort(
        (a, b) =>
          sortText(a.file, b.file) || a.line - b.line || a.column - b.column,
      ),
    definitions: declarations
      .filter(ts.isTypeAliasDeclaration)
      .map((node) => portableText(node.type.getText()))
      .sort(sortText),
    extends: declarations
      .filter(
        (node) =>
          ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node),
      )
      .flatMap(
        (node) =>
          node.heritageClauses?.flatMap((clause) =>
            clause.types.map((type) => portableText(type.getText())),
          ) ?? [],
      )
      .sort(sortText),
    status: 'pending',
    evidenceIds: [],
    imports: [],
    references: [],
    members: [],
  };
  const internal = { api, target, memberSymbols: [] };
  function members(type, side, owners) {
    for (const member of checker.getPropertiesOfType(type)) {
      if (member.name === 'prototype' || member.name.startsWith('__@'))
        continue;
      const memberDeclarations = member.declarations ?? [];
      if (
        memberDeclarations.length === 0 ||
        !memberDeclarations.every(publicDeclaration)
      )
        continue;
      const own = memberDeclarations.filter(
        (node) =>
          owners.has(node.parent) ||
          (ts.isParameter(node) && owners.has(node.parent?.parent)),
      );
      if (owners.size > 0 && own.length === 0) continue;
      const memberNode = member.valueDeclaration ?? memberDeclarations[0];
      const memberType = checker.getTypeOfSymbolAtLocation(member, memberNode);
      const descriptor = {
        id: `${api.id}#${side}:${member.name}`,
        name: member.name,
        side,
        kind:
          member.flags & ts.SymbolFlags.Method
            ? 'method'
            : member.flags & ts.SymbolFlags.EnumMember
              ? 'enum-member'
              : member.flags & ts.SymbolFlags.Accessor
                ? 'accessor'
                : 'property',
        typeText: describeType(memberType, memberNode),
        callSignatures: checker
          .getSignaturesOfType(memberType, ts.SignatureKind.Call)
          .map((signature) =>
            portableText(
              checker.signatureToString(signature, memberNode, flags),
            ),
          )
          .sort(sortText),
        declarations: (own.length ? own : memberDeclarations).map(location),
        status: 'pending',
        evidenceIds: [],
        references: [],
      };
      const enumDeclaration = memberDeclarations.find(ts.isEnumMember);
      if (enumDeclaration)
        descriptor.constantValue =
          checker.getConstantValue(enumDeclaration) ?? null;
      api.members.push(descriptor);
      internal.memberSymbols.push({ symbol: member, descriptor });
    }
  }
  if (kind === 'class' || kind === 'interface') {
    const owners = new Set(declarations);
    members(declaredType, 'instance', owners);
    if (kind === 'class') members(valueType, 'static', owners);
  } else if (kind === 'enum') {
    members(valueType, 'value', new Set(declarations));
  } else if (
    kind === 'variable' &&
    valueType.getCallSignatures().length === 0 &&
    valueType.flags & ts.TypeFlags.Object
  ) {
    members(
      valueType,
      'value',
      new Set(valueType.getSymbol()?.declarations ?? []),
    );
  }
  api.members.sort((a, b) => sortText(a.id, b.id));
  return internal;
}

function usageKind(node) {
  let parent = node.parent;
  if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node)
    node = parent;
  parent = node.parent;
  if (parent && ts.isCallExpression(parent) && parent.expression === node)
    return ts.isDecorator(parent.parent) ? 'decorator-call' : 'call';
  if (parent && ts.isNewExpression(parent) && parent.expression === node)
    return 'construct';
  for (
    let current = parent;
    current && !ts.isStatement(current);
    current = current.parent
  ) {
    if (ts.isHeritageClause(current)) return 'heritage';
    if (ts.isTypeNode(current)) return 'type';
    if (ts.isExpression(current) && !ts.isPropertyAccessExpression(current))
      break;
  }
  return 'value';
}
function extractReferences(checker, sources, internals, packageByName) {
  const memberDeclarations = new Map();
  for (const entry of internals.values())
    for (const member of entry.memberSymbols) {
      for (const rootSymbol of checker.getRootSymbols(member.symbol))
        for (const declaration of rootSymbol.declarations ?? []) {
          const list = memberDeclarations.get(declaration) ?? [];
          list.push({ api: entry.api, member: member.descriptor });
          memberDeclarations.set(declaration, list);
        }
    }
  const sourceIndex = [];
  for (const source of sources) {
    const bindings = new Map();
    const namespaces = new Map();
    const ignored = new Set();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const packageName = statement.moduleSpecifier.text;
      const packageInfo = packageByName.get(packageName);
      if (!packageInfo) {
        if (packageName.startsWith('@nestjs/'))
          sourceIndex.push({
            ...location(statement),
            specifier: packageName,
            category: 'excluded-subpath-or-package-import',
          });
        continue;
      }
      const clause = statement.importClause;
      if (!clause) {
        sourceIndex.push({
          ...location(statement),
          specifier: packageName,
          category: 'side-effect-import',
        });
        continue;
      }
      if (clause.name) {
        const entry = internals.get(`${packageName}::default`);
        if (entry) {
          bindings.set(checker.getSymbolAtLocation(clause.name), entry.api);
          ignored.add(clause.name);
          entry.api.imports.push({
            ...location(clause.name),
            localName: clause.name.text,
            typeOnly: clause.isTypeOnly,
          });
        }
      }
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        namespaces.set(
          checker.getSymbolAtLocation(clause.namedBindings.name),
          packageName,
        );
        ignored.add(clause.namedBindings.name);
        packageInfo.namespaceImports.push({
          ...location(clause.namedBindings),
          localName: clause.namedBindings.name.text,
          typeOnly: clause.isTypeOnly,
        });
      } else if (clause.namedBindings) {
        for (const specifier of clause.namedBindings.elements) {
          const name = (specifier.propertyName ?? specifier.name).text;
          const entry = internals.get(`${packageName}::${name}`);
          if (!entry) continue;
          bindings.set(checker.getSymbolAtLocation(specifier.name), entry.api);
          ignored.add(specifier.name);
          if (specifier.propertyName) ignored.add(specifier.propertyName);
          entry.api.imports.push({
            ...location(specifier),
            localName: specifier.name.text,
            typeOnly: clause.isTypeOnly || specifier.isTypeOnly,
          });
        }
      }
    }
    function reference(api, node, extra = {}) {
      api.references.push({
        ...location(node),
        kind: usageKind(node),
        ...extra,
      });
    }
    function visit(node) {
      if (ts.isImportDeclaration(node)) return;
      // An explicit `implements` links a declaration to an interface member even
      // when Nest, rather than user code, invokes that lifecycle/strategy method.
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        for (const clause of node.heritageClauses ?? []) {
          if (clause.token !== ts.SyntaxKind.ImplementsKeyword) continue;
          for (const implemented of clause.types) {
            const contract = checker.getTypeAtLocation(implemented);
            for (const implementation of node.members) {
              if (!implementation.name || !publicDeclaration(implementation))
                continue;
              if (
                !ts.isIdentifier(implementation.name) &&
                !ts.isStringLiteralLike(implementation.name)
              )
                continue;
              const property = checker.getPropertyOfType(
                contract,
                implementation.name.text,
              );
              if (!property) continue;
              for (const symbol of checker.getRootSymbols(property))
                for (const declaration of symbol.declarations ?? []) {
                  for (const { api, member } of memberDeclarations.get(
                    declaration,
                  ) ?? []) {
                    const ref = {
                      ...location(implementation.name),
                      kind: 'implements-member',
                      memberId: member.id,
                    };
                    member.references.push(ref);
                    api.references.push(ref);
                  }
                }
            }
          }
        }
      }
      if (ts.isIdentifier(node) && !ignored.has(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        const bound = bindings.get(symbol);
        if (bound) reference(bound, node);
      }
      if (ts.isPropertyAccessExpression(node) || ts.isQualifiedName(node)) {
        const left = ts.isPropertyAccessExpression(node)
          ? node.expression
          : node.left;
        const name = ts.isPropertyAccessExpression(node)
          ? node.name
          : node.right;
        const packageName = namespaces.get(checker.getSymbolAtLocation(left));
        if (packageName) {
          const entry = internals.get(`${packageName}::${name.text}`);
          if (entry) reference(entry.api, name, { via: 'namespace' });
        }
        const symbol = checker.getSymbolAtLocation(name);
        if (symbol) {
          const seen = new Set();
          for (const rootSymbol of checker.getRootSymbols(symbol))
            for (const declaration of rootSymbol.declarations ?? []) {
              for (const { api, member } of memberDeclarations.get(
                declaration,
              ) ?? []) {
                if (seen.has(member.id)) continue;
                seen.add(member.id);
                const ref = {
                  ...location(name),
                  kind: usageKind(name),
                  memberId: member.id,
                };
                member.references.push(ref);
                api.references.push(ref);
              }
            }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const deduplicate = (references) =>
    [
      ...new Map(references.map((ref) => [JSON.stringify(ref), ref])).values(),
    ].sort(
      (a, b) =>
        sortText(a.file, b.file) ||
        a.line - b.line ||
        a.column - b.column ||
        sortText(a.kind ?? '', b.kind ?? ''),
    );
  for (const { api } of internals.values()) {
    api.imports = deduplicate(api.imports);
    api.references = deduplicate(api.references);
    if (api.imports.length || api.references.length) api.status = 'referenced';
    for (const member of api.members) {
      member.references = deduplicate(member.references);
      if (member.references.length) member.status = 'referenced';
    }
  }
  return sourceIndex.sort(
    (a, b) => sortText(a.file, b.file) || a.line - b.line,
  );
}

function testTitles(source) {
  const titles = new Map();
  const unsafeModifiers = new Set(['skip', 'todo', 'skipIf', 'runIf']);
  function callIdentity(expression) {
    const modifiers = [];
    while (true) {
      if (ts.isCallExpression(expression)) expression = expression.expression;
      else if (ts.isPropertyAccessExpression(expression)) {
        modifiers.push(expression.name.text);
        expression = expression.expression;
      } else if (
        ts.isElementAccessExpression(expression) &&
        ts.isStringLiteralLike(expression.argumentExpression)
      ) {
        modifiers.push(expression.argumentExpression.text);
        expression = expression.expression;
      } else break;
    }
    return {
      name: ts.isIdentifier(expression) ? expression.text : undefined,
      modifiers,
    };
  }
  function visit(node, enclosingModifiers = []) {
    let childModifiers = enclosingModifiers;
    if (
      ts.isCallExpression(node) &&
      node.arguments.length &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const { name, modifiers } = callIdentity(node.expression);
      const unsafe = modifiers.filter((modifier) =>
        unsafeModifiers.has(modifier),
      );
      if (name === 'describe')
        childModifiers = [...enclosingModifiers, ...unsafe];
      if (['it', 'test'].includes(name)) {
        const title = node.arguments[0].text;
        titles.set(title, [
          ...(titles.get(title) ?? []),
          ...enclosingModifiers,
          ...unsafe,
        ]);
      }
    }
    ts.forEachChild(node, (child) => visit(child, childModifiers));
  }
  visit(source);
  return titles;
}
function applyEvidence(evidence, internals, packages, sourceByPath) {
  assert.equal(evidence.schemaVersion, 1);
  const ids = new Set();
  for (const item of evidence.cases) {
    assert.ok(
      item.id && !ids.has(item.id),
      `Duplicate/empty evidence ID: ${item.id}`,
    );
    ids.add(item.id);
    assert.ok(
      item.contract &&
        item.limits?.length &&
        item.apis?.length &&
        item.sourcePaths?.length &&
        item.tests?.length,
      `Incomplete evidence: ${item.id}`,
    );
    assert.ok(['verified-case', 'pending'].includes(item.status));
    for (const path of item.sourcePaths) projectPath(path);
    for (const test of item.tests) {
      projectPath(test.file);
      const source = sourceByPath.get(test.file);
      assert.ok(
        source && testTitles(source).has(test.title),
        `Unknown test title in ${item.id}: ${test.file}::${test.title}`,
      );
      if (item.status === 'verified-case')
        assert.deepEqual(
          testTitles(source).get(test.title),
          [],
          `Disabled/conditional test cannot retain verified evidence in ${item.id}: ${test.file}::${test.title}`,
        );
      assert.ok(test.command, `Missing reproducible command: ${item.id}`);
    }
    if (item.status === 'verified-case')
      assert.ok(
        item.verification?.date &&
          item.verification.result === 'passed' &&
          item.verification.basis,
        `Missing execution confirmation: ${item.id}`,
      );
    for (const target of item.apis) {
      const packageInfo = packages.get(target.package);
      assert.equal(
        packageInfo?.version,
        target.version,
        `Package version drift in ${item.id}: ${target.package}`,
      );
      const entry = internals.get(`${target.package}::${target.export}`);
      assert.ok(
        entry,
        `Unknown public root export in ${item.id}: ${target.package}::${target.export}`,
      );
      const api = entry.api;
      assert.ok(
        api.references.some((ref) => item.sourcePaths.includes(ref.file)),
        `No non-import AST reference in example for ${item.id}: ${api.id}`,
      );
      if (item.status === 'verified-case') {
        api.status = 'verified-case';
        if (!api.evidenceIds.includes(item.id)) api.evidenceIds.push(item.id);
      }
      for (const selected of target.members ?? []) {
        const member = api.members.find(
          (member) =>
            member.name === selected.name && member.side === selected.side,
        );
        assert.ok(
          member,
          `Unknown public member in ${item.id}: ${api.id}#${selected.side}:${selected.name}`,
        );
        assert.ok(
          member.references.some((ref) => item.sourcePaths.includes(ref.file)),
          `No AST member reference in example for ${item.id}: ${member.id}`,
        );
        if (item.status === 'verified-case') {
          member.status = 'verified-case';
          if (!member.evidenceIds.includes(item.id))
            member.evidenceIds.push(item.id);
        }
      }
    }
  }
}

function buildInventory() {
  const manifest = readJson(resolve(root, 'package.json'));
  const names = new Set(
    Object.keys(manifest.dependencies ?? {}).filter((name) =>
      name.startsWith('@nestjs/'),
    ),
  );
  if (manifest.devDependencies?.['@nestjs/testing'])
    names.add('@nestjs/testing');
  const configPath = ts.findConfigFile(
    root,
    ts.sys.fileExists,
    'tsconfig.json',
  );
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.ok(!config.error, 'Cannot read tsconfig.json');
  const options = {
    ...ts.parseJsonConfigFileContent(config.config, ts.sys, root).options,
    noEmit: true,
    incremental: false,
    allowNonTsExtensions: true,
  };
  const packages = new Map();
  for (const name of [...names].sort(sortText)) {
    const packageManifest = readJson(
      resolve(root, 'node_modules', name, 'package.json'),
    );
    const resolution = ts.resolveModuleName(
      name,
      resolve(root, '__nest_api_inventory__.mts'),
      options,
      ts.sys,
      undefined,
      undefined,
      ts.ModuleKind.ESNext,
    ).resolvedModule;
    assert.ok(
      resolution,
      `Cannot resolve public root entrypoint ${name}; install locked dependencies first`,
    );
    packages.set(name, {
      name,
      version: packageManifest.version,
      requestedVersion:
        manifest.dependencies?.[name] ?? manifest.devDependencies?.[name],
      dependencyKind: manifest.dependencies?.[name]
        ? 'runtime-direct'
        : 'testing-direct-dev',
      entrypoint: '.',
      declarationEntrypoint: normalizedPath(resolution.resolvedFileName),
      resolvedFile: resolution.resolvedFileName,
      excludedExportPatterns:
        typeof packageManifest.exports === 'object' &&
        packageManifest.exports !== null
          ? Object.keys(packageManifest.exports)
              .filter((key) => key !== '.')
              .sort(sortText)
          : [
              'Deep imports are not enumerated, even when package exports has no restriction.',
            ],
      namespaceImports: [],
      exports: [],
    });
  }
  const sourcePaths = [
    ...walk(resolve(root, 'src')),
    ...walk(resolve(root, 'test')),
  ].sort(sortText);
  const program = ts.createProgram(
    [...packages.values()].map((p) => p.resolvedFile).concat(sourcePaths),
    options,
  );
  const checker = program.getTypeChecker();
  const runtime = runtimeExportResolver(checker);
  const internals = new Map();
  for (const pkg of packages.values()) {
    const source = program.getSourceFile(pkg.resolvedFile);
    assert.ok(source, `Missing declaration source ${pkg.name}`);
    const moduleSymbol = checker.getSymbolAtLocation(source);
    assert.ok(
      moduleSymbol,
      `Root declarations are not an external module: ${pkg.name}`,
    );
    for (const symbol of checker
      .getExportsOfModule(moduleSymbol)
      .sort((a, b) => sortText(a.name, b.name))) {
      const description = describeApi(
        checker,
        moduleSymbol,
        symbol,
        pkg.name,
        runtime,
      );
      internals.set(description.api.id, description);
      pkg.exports.push(description.api);
    }
    delete pkg.resolvedFile;
  }
  const sources = sourcePaths
    .map((path) => program.getSourceFile(path))
    .filter(Boolean);
  assert.equal(
    sources.length,
    sourcePaths.length,
    'Some src/test files were not parsed',
  );
  const sourceByPath = new Map(
    sources.map((source) => [normalizedPath(source.fileName), source]),
  );
  const excludedImports = extractReferences(
    checker,
    sources,
    internals,
    packages,
  );
  const evidence = existsSync(evidencePath)
    ? readJson(evidencePath)
    : { schemaVersion: 1, cases: [] };
  applyEvidence(evidence, internals, packages, sourceByPath);
  const countByStatus = (items) =>
    items.reduce(
      (counts, item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
        return counts;
      },
      { pending: 0, referenced: 0, 'verified-case': 0 },
    );
  const apis = [...internals.values()].map(({ api }) => api);
  const members = apis.flatMap((api) => api.members);
  for (const pkg of packages.values())
    pkg.summary = {
      exports: pkg.exports.length,
      declaredRuntimeValues: pkg.exports.filter(
        (api) => api.availability === 'declared-runtime-value',
      ).length,
      typeOnlyExports: pkg.exports.filter(
        (api) => api.availability === 'type-only',
      ).length,
      statusCounts: countByStatus(pkg.exports),
      publicDeclaredMembers: pkg.exports.reduce(
        (total, api) => total + api.members.length,
        0,
      ),
    };
  const sourceFiles = sourcePaths.map((path) => ({
    file: normalizedPath(path),
    sha256: hash(readFileSync(path)),
  }));
  const declarationFiles = program
    .getSourceFiles()
    .filter(
      (source) =>
        source.isDeclarationFile &&
        /^node_modules\/@nestjs\//.test(normalizedPath(source.fileName)),
    )
    .map((source) => ({
      file: normalizedPath(source.fileName),
      sha256: hash(source.text),
    }))
    .sort((a, b) => sortText(a.file, b.file) || sortText(a.sha256, b.sha256));
  const result = {
    schemaVersion: 1,
    title:
      'Exports públicos raíz de NestJS: versión instalada → referencia AST → caso explícito',
    generator: {
      script: 'scripts/nest-api-inventory.mjs',
      typescriptVersion: ts.version,
      command: 'node scripts/nest-api-inventory.mjs',
      checkCommand: 'node scripts/nest-api-inventory.mjs --check',
      selfTestCommand: 'node scripts/nest-api-inventory.mjs --self-test',
    },
    scope: {
      packageSelection:
        'Todos los @nestjs/* de dependencies directas y @nestjs/testing de devDependencies. Se usan versiones instaladas, no rangos de manifest.',
      entrypoints:
        'Solo export raíz "." resuelto como NodeNext/import/types. No se importan ni ejecutan los paquetes para descubrir runtime.',
      declarationMeaning:
        'declared-runtime-value significa valor según declaraciones y sintaxis export; no garantiza presencia/behavior del JavaScript publicado.',
      members:
        'Miembros públicos declarados de clases/interfaces, estáticos, enums y tipos objeto de constantes como NestFactory. Se omiten private/protected, miembros heredados como entradas nuevas y nombres de símbolos computados.',
      signatures:
        'Firmas de llamadas/construcción y métodos según TypeChecker; un caso no verifica cada overload, genérico, opción ni combinación.',
      sourceFiles:
        'AST de src/test .ts/.tsx/.mts/.cts y templates TypeScript. Incluye fixtures de tipos y pruebas; no equivale a ejecución de todas las referencias.',
      excluded: [
        'Subpaths (incluidos internal, decorators/* y plugins CLI), condiciones browser/react-native y exports de paquetes transitivos no seleccionados.',
        'CLI, schematics y otros @nestjs/* de devDependencies salvo testing.',
        'No inventario exhaustivo del lenguaje TypeScript ni comparación con Typers.',
        'No seguimiento completo de alias asignados a variables, destructuring, reflexión, acceso dinámico a propiedades, imports dinámicos ni cuerpos materializados a partir de strings.',
      ],
    },
    interpretation: {
      pending:
        'Sin import ni referencia AST registrada y sin caso manual verificado.',
      referenced:
        'Import o uso AST identificado. Consultar imports/references y kind: puede ser solo import o solo tipo; no acredita ejecución.',
      'verified-case':
        'Evidencia manual explícita enlaza esta API/version y, cuando procede, miembros concretos con ejemplo, prueba y contrato pasado. No cubre toda la API.',
      imports:
        'Se guardan nombre local y typeOnly. Un namespace import no marca todos los exports del paquete.',
      references:
        'Identidad semántica por símbolos de TypeScript, no coincidencias de texto. Llamadas, construcciones, tipos, herencia y valores permanecen diferenciados. implements-member relaciona una declaración propia con su contrato implements explícito; no acredita que se invoque.',
      evidence:
        'El checker valida rutas, títulos AST de tests, versiones y referencia semántica de la API/miembro; rechaza evidencia verified-case de tests o describe con skip/todo/skipIf/runIf. No ejecuta las pruebas ni puede demostrar automáticamente el contrato humano.',
    },
    fingerprints: {
      generatorSha256: hash(readFileSync(scriptPath)),
      compilerConfigSha256: hash(
        json({
          config: readFileSync(configPath, 'utf8'),
          options: portableCompilerOptions(options),
        }),
      ),
      packageSelectionSha256: hash(
        json(
          [...packages.values()].map(({ name, version, requestedVersion }) => ({
            name,
            version,
            requestedVersion,
          })),
        ),
      ),
      lockfileSha256: hash(readFileSync(resolve(root, 'pnpm-lock.yaml'))),
      sourceSha256: hash(json(sourceFiles)),
      declarationSha256: hash(json(declarationFiles)),
      evidenceSha256: hash(json(evidence)),
    },
    summary: {
      packages: packages.size,
      rootExports: apis.length,
      statusCounts: countByStatus(apis),
      declaredRuntimeValues: apis.filter(
        (api) => api.availability === 'declared-runtime-value',
      ).length,
      typeOnlyExports: apis.filter((api) => api.availability === 'type-only')
        .length,
      importOnlyExports: apis.filter(
        (api) => api.imports.length && !api.references.length,
      ).length,
      publicDeclaredMembers: members.length,
      memberStatusCounts: countByStatus(members),
      manualCases: evidence.cases.filter(
        (item) => item.status === 'verified-case',
      ).length,
      parsedSourceFiles: sources.length,
    },
    packages: [...packages.values()],
    sourceFiles,
    declarationFiles,
    excludedImports,
    evidenceCases: evidence.cases,
  };
  result.fingerprints.inventorySha256 = hash(json(result));
  return result;
}

function renderMarkdown(inventory) {
  const s = inventory.summary;
  const link = (path) => `[${path}](../${path})`;
  const safe = (text) =>
    String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines = [
    '# APIs públicas de NestJS: inventario reproducible',
    '',
    `**${s.rootExports} exports raíz de ${s.packages} paquetes instalados**, con ${s.publicDeclaredMembers} miembros públicos declarados. [Datos completos](nest-api-coverage.json) · [Evidencia manual](nest-api-evidence.json).`,
    '',
    '**Un caso verificado no cierra la API, sus overloads ni todas sus opciones.** Los imports y las referencias AST se conservan separados; ninguna coincidencia de texto promueve una API a verificada.',
    '',
    '## Alcance y método',
    '',
    ...Object.values(inventory.scope)
      .filter((value) => typeof value === 'string')
      .map((value) => '- ' + value),
    ...inventory.scope.excluded.map((value) => '- Excluido: ' + value),
    '',
    'El script usa el TypeChecker de TypeScript ' +
      inventory.generator.typescriptVersion +
      ' y sigue reexports, aliases y `export type`. No ejecuta imports de paquetes Nest. Un valor declarado para runtime puede requerir una comprobación adicional del JavaScript publicado.',
    '',
    '## Estados',
    '',
    '| Estado | Exports raíz | Miembros | Significado |',
    '| --- | ---: | ---: | --- |',
    ...['pending', 'referenced', 'verified-case'].map(
      (status) =>
        `| \`${status}\` | ${s.statusCounts[status]} | ${s.memberStatusCounts[status]} | ${inventory.interpretation[status]} |`,
    ),
    '',
    `Hay ${s.declaredRuntimeValues} exports declarados como valores y ${s.typeOnlyExports} exclusivos de tipos. ${s.importOnlyExports} exports aparecen solo en imports, sin uso AST identificado. ${s.manualCases} casos manuales sostienen las promociones; se cuentan una vez aunque cubran varios exports.`,
    '',
    '## Reproducir y detectar cambios',
    '',
    '```sh',
    'node scripts/nest-api-inventory.mjs',
    'node scripts/nest-api-inventory.mjs --check',
    'node scripts/nest-api-inventory.mjs --self-test',
    '```',
    '',
    '`--check` reconstruye ambos artefactos en memoria y compara su contenido exacto. Falla por drift de versiones/declaraciones, fuentes, evidencia o generador; también detecta rutas, exports, miembros y títulos de tests rotos. Rechaza conservar casos verificados con skip/todo o condiciones skipIf/runIf en tests/describe. No vuelve a ejecutar tests ni cambia estados por su cuenta. Tras un cambio legítimo se revisa la evidencia, se vuelve a generar y se ejecuta el check.',
    '',
    'Las rutas y hashes se normalizan para no depender del directorio absoluto del checkout ni de los hashes de carpetas de pnpm. No hay timestamps de generación que produzcan drift por el mero paso del tiempo. La fecha de cada caso es su confirmación explícita.',
    '',
    '## Paquetes y versiones',
    '',
    '| Paquete | Versión instalada | Exports | pending / referenced / verified-case | Miembros públicos |',
    '| --- | --- | ---: | --- | ---: |',
    ...inventory.packages.map(
      (pkg) =>
        `| \`${pkg.name}\` | ${pkg.version} | ${pkg.summary.exports} | ${pkg.summary.statusCounts.pending} / ${pkg.summary.statusCounts.referenced} / ${pkg.summary.statusCounts['verified-case']} | ${pkg.summary.publicDeclaredMembers} |`,
    ),
    '',
    '## Casos explícitos',
    '',
  ];
  for (const item of inventory.evidenceCases) {
    lines.push(
      `### ${item.id}`,
      '',
      `**${item.status}** — ${item.contract}`,
      '',
      'APIs: ' +
        item.apis
          .map(
            (api) =>
              `\`${api.package}@${api.version}::${api.export}\`` +
              (api.members?.length
                ? ' (' +
                  api.members
                    .map((member) => `\`${member.side}:${member.name}\``)
                    .join(', ') +
                  ')'
                : ''),
          )
          .join('; ') +
        '.',
      '',
      'Ejemplos: ' + item.sourcePaths.map(link).join(', ') + '.',
      '',
      ...item.tests.map(
        (test) =>
          '- ' +
          link(test.file) +
          ': `' +
          test.title +
          '`; `' +
          test.command +
          '`.',
      ),
      '',
      'Límites: ' + item.limits.join(' '),
      '',
    );
  }
  lines.push(
    '## Índice por export raíz',
    '',
    'El JSON conserva declaraciones, firmas, miembros, imports y cada referencia con línea/columna. Esta tabla resume referencias y casos sin presentar el mero uso como prueba.',
    '',
  );
  for (const pkg of inventory.packages) {
    lines.push(
      `### ${pkg.name} ${pkg.version}`,
      '',
      '| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |',
      '| --- | --- | --- | ---: | --- |',
    );
    for (const api of pkg.exports)
      lines.push(
        `| \`${safe(api.name)}\` | ${api.kind} / ${api.availability} | ${api.status} | ${api.imports.length} / ${api.references.length} | ${api.evidenceIds.map((id) => '`' + id + '`').join(', ') || '—'} |`,
      );
    lines.push('');
  }
  lines.push(
    '## Límites de interpretación',
    '',
    '- Los miembros heredados siguen disponibles en TypeScript pero se inventarían en su declaración original; no se duplica cada método en todas las subclases/interfaces.',
    '- Se identifica el símbolo por TypeChecker. Los casts, valores dinámicos, reexports propios y transformaciones de código pueden dejar usos sin atribuir. Las referencias se clasifican, no se evalúan.',
    '- La evidencia de interfaces y tipos verifica contratos concretos usados por el ejemplo; no prueba todas las asignaciones posibles.',
    '- Las firmas representan las declaraciones instaladas; los cambios en paquetes transitivos quedan cubiertos por el hash del lockfile, sin afirmar que sus APIs estén en este inventario.',
    '- Las promociones de miembros son explícitas. Verificar un export de clase no verifica automáticamente sus métodos, y usar un método no verifica cada overload.',
    '- Los subpaths quedan fuera incluso cuando un patrón wildcard los permite. Esto incluye los plugins CLI de GraphQL/Swagger, que cuentan con pruebas separadas del corpus documental.',
    '- Este inventario no acredita compatibilidad universal con NestJS ni ejecución mediante Typers.',
    '',
  );
  return lines.join('\n');
}

function selfTest() {
  assert.deepEqual(
    portableCompilerOptions({
      rootDir: resolve(root),
      nested: [resolve(root, 'dist'), 'ES2023'],
    }),
    { rootDir: '<repository>', nested: ['<repository>/dist', 'ES2023'] },
  );
  const testSource = ts.createSourceFile(
    'tests.ts',
    `
it('active', () => {});
it.skip('skipped', () => {});
test.todo('todo');
it.skipIf(false)('conditional', () => {});
describe.skip('disabled suite', () => { it('nested', () => {}); });
describe.runIf(true)('conditional suite', () => { test.each([1, 2])('nested each %i', () => {}); });
it.each([1, 2])('active each %i', () => {});
`,
    ts.ScriptTarget.Latest,
    true,
  );
  const recordedTests = testTitles(testSource);
  assert.deepEqual(recordedTests.get('active'), []);
  assert.deepEqual(recordedTests.get('active each %i'), []);
  assert.deepEqual(recordedTests.get('skipped'), ['skip']);
  assert.deepEqual(recordedTests.get('todo'), ['todo']);
  assert.deepEqual(recordedTests.get('conditional'), ['skipIf']);
  assert.deepEqual(recordedTests.get('nested'), ['skip']);
  assert.deepEqual(recordedTests.get('nested each %i'), ['runIf']);
  const directory = '/virtual-nest-api';
  const files = new Map([
    [directory + '/base.d.ts', 'export class Base { inherited(): void; }'],
    [directory + '/other.d.ts', 'export class OnlyType { read(): number; }'],
    [
      directory + '/api.d.ts',
      `import { Base } from './base.js';
export class Service<T> extends Base { private hidden; protected internal(): void; get(key: keyof T): T[keyof T]; static make(): Service<object>; }
export type { Service as TypeOnlyService };
export { Service as ServiceAlias };
export type * from './other.js';
export interface Options { enabled: boolean; }
export interface Strategy { attach(): void; }
export declare const UNUSED: unique symbol;
export declare const Factory: { create(): Service<object> };
`,
    ],
    [
      directory + '/main.ts',
      `import { Service as Renamed, UNUSED } from '@nestjs/example';
import type { Options, Strategy } from '@nestjs/example';
import * as Nest from '@nestjs/example';
const instance = new Renamed<{name:string}>();
instance.get('name');
Renamed.make();
Nest.Factory.create();
const options: Options = {enabled: true};
function shadow(){ const Renamed = { unrelated() {} }; Renamed.unrelated(); }
void options; void shadow;
class ExampleStrategy implements Strategy { attach() {} }
class UnrelatedStrategy { attach() {} }
`,
    ],
  ]);
  const options = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noLib: true,
    noEmit: true,
  };
  const host = ts.createCompilerHost(options);
  host.fileExists = (path) => files.has(path);
  host.readFile = (path) => files.get(path);
  host.getSourceFile = (path, languageVersion) =>
    files.has(path)
      ? ts.createSourceFile(path, files.get(path), languageVersion, true)
      : undefined;
  host.resolveModuleNames = (names, containing) =>
    names.map((name) => ({
      resolvedFileName:
        name === '@nestjs/example'
          ? directory + '/api.d.ts'
          : resolve(dirname(containing), name.replace(/\.js$/, '.d.ts')),
      extension: ts.Extension.Dts,
    }));
  const program = ts.createProgram([...files.keys()], options, host);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(directory + '/api.d.ts');
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const runtime = runtimeExportResolver(checker);
  const internals = new Map(
    checker.getExportsOfModule(moduleSymbol).map((symbol) => {
      const entry = describeApi(
        checker,
        moduleSymbol,
        symbol,
        '@nestjs/example',
        runtime,
      );
      return [entry.api.id, entry];
    }),
  );
  extractReferences(
    checker,
    [program.getSourceFile(directory + '/main.ts')],
    internals,
    new Map([['@nestjs/example', { namespaceImports: [] }]]),
  );
  const api = (name) => internals.get('@nestjs/example::' + name).api;
  assert.equal(api('Service').availability, 'declared-runtime-value');
  assert.equal(api('TypeOnlyService').availability, 'type-only');
  assert.equal(api('OnlyType').availability, 'type-only');
  assert.equal(api('Options').availability, 'type-only');
  assert.equal(api('ServiceAlias').availability, 'declared-runtime-value');
  assert.deepEqual(
    api('Service')
      .members.map((member) => member.name)
      .sort(),
    ['get', 'make'],
  );
  assert.equal(api('UNUSED').imports.length, 1);
  assert.equal(api('UNUSED').references.length, 0);
  assert.ok(api('Options').imports[0].typeOnly);
  assert.ok(api('Options').references.every((ref) => ref.kind === 'type'));
  assert.ok(api('Service').references.some((ref) => ref.kind === 'construct'));
  assert.ok(
    api('Service').members.find((member) => member.name === 'get').references
      .length > 0,
  );
  assert.equal(
    api('Factory').members.find((member) => member.name === 'create').references
      .length,
    1,
  );
  assert.deepEqual(
    api('Strategy')
      .members.find((member) => member.name === 'attach')
      .references.map((ref) => ref.kind),
    ['implements-member'],
  );
  assert.ok(
    !api('Service').references.some((ref) => ref.line === 10),
    'A shadowed local name must not become a Nest reference',
  );
  process.stdout.write(
    'Self-test passed: portable compiler paths, disabled/conditional test evidence, type-only reexports/stars, aliases, public/implemented members, generic calls, namespace imports, unused imports, type positions and shadowing.\n',
  );
}

try {
  const argumentsSet = new Set(process.argv.slice(2));
  assert.ok(
    [...argumentsSet].every((argument) =>
      ['--check', '--self-test'].includes(argument),
    ),
    'Usage: node scripts/nest-api-inventory.mjs [--check | --self-test]',
  );
  if (argumentsSet.has('--self-test')) selfTest();
  else {
    const inventory = buildInventory();
    const expectedJson = json(inventory);
    const expectedMd = renderMarkdown(inventory);
    if (argumentsSet.has('--check')) {
      const drift = [
        [outputJson, expectedJson],
        [outputMd, expectedMd],
      ]
        .filter(
          ([path, value]) =>
            !existsSync(path) || readFileSync(path, 'utf8') !== value,
        )
        .map(([path]) => normalizedPath(path));
      assert.equal(
        drift.length,
        0,
        `API inventory drift: ${drift.join(', ')}. Review evidence and run node scripts/nest-api-inventory.mjs.`,
      );
    } else {
      writeFileSync(outputJson, expectedJson);
      writeFileSync(outputMd, expectedMd);
    }
    process.stdout.write(
      json({
        status: argumentsSet.has('--check') ? 'consistent' : 'generated',
        ...inventory.summary,
      }),
    );
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
