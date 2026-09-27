import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(
  readFileSync(resolve(root, 'docs/nest-coverage.json'), 'utf8'),
);
assert.equal(inventory.schemaVersion, 2);
const unique = (values, label) =>
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
const checkPath = (path) => {
  assert.ok(
    !relative(root, resolve(root, path)).startsWith('..'),
    `Path outside repository: ${path}`,
  );
  assert.ok(existsSync(resolve(root, path)), `Missing evidence: ${path}`);
};
const countStatuses = (items) =>
  items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
unique(
  inventory.chapters.map((chapter) => chapter.id),
  'chapter ID',
);
assert.equal(inventory.chapters.length, inventory.count.chapters);
const sections = inventory.chapters.flatMap((chapter) => chapter.subsections);
unique(
  sections.map((section) => section.id),
  'subsection ID',
);
assert.equal(sections.length, inventory.count.subsections);
const knownTestIds = new Set();
for (const run of Object.values(inventory.testRuns)) {
  checkPath(run.testFile);
  unique(run.testIds, 'test ID in run');
  run.testIds.forEach((id) => knownTestIds.add(id));
  assert.ok(run.command && run.instantiatedCases >= 1);
  if (run.status === 'passed') assert.ok(run.lastVerified);
}
for (const chapter of inventory.chapters) {
  assert.ok(new URL(chapter.url).protocol === 'https:');
  chapter.evidence.sourcePaths.forEach(checkPath);
  for (const id of chapter.evidence.testRunIds)
    assert.ok(inventory.testRuns[id], `Unknown test run: ${id}`);
  for (const id of chapter.evidence.testIds)
    assert.ok(knownTestIds.has(id), `Unregistered test ID: ${id}`);
  if (chapter.status === 'verified-case') {
    assert.ok(chapter.implementedScope && chapter.evidence.lastVerified);
    assert.ok(chapter.evidence.commands.length > 0);
  }
}
const summary = inventory.coverageSummary;
assert.deepEqual(
  countStatuses(inventory.chapters),
  summary.chapterStatusCounts,
);
assert.deepEqual(countStatuses(sections), summary.subsectionStatusCounts);
const passedRuns = Object.values(inventory.testRuns).filter(
  (run) => run.status === 'passed',
);
assert.equal(
  passedRuns.reduce((sum, run) => sum + run.instantiatedCases, 0),
  summary.verifiedInstantiatedTestCases,
);
assert.equal(
  new Set(passedRuns.map((run) => run.testFile)).size,
  summary.verifiedTestFiles,
);
console.log(
  JSON.stringify(
    {
      status: 'consistent',
      chapters: inventory.chapters.length,
      subsections: sections.length,
      registeredTests: summary.verifiedInstantiatedTestCases,
      note: 'Checks inventory integrity; does not execute tests or promote coverage status.',
    },
    null,
    2,
  ),
);
