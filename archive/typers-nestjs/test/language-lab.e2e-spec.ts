import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareLanguageWorkspace } from '../src/language-lab/prepare-workspace.js';
const execute = promisify(execFile);

describe('TypeScript language fixtures emitted as ESM and executed by Node', () => {
  let workspace: Awaited<ReturnType<typeof prepareLanguageWorkspace>>;
  const run = async (args: string[]) => {
    try {
      return await execute(process.execPath, args, {
        cwd: workspace.directory,
        timeout: 15000,
        maxBuffer: 2_000_000,
      });
    } catch (error) {
      const details = error as Error & { stdout?: string; stderr?: string };
      throw new Error(
        [details.message, details.stdout, details.stderr]
          .filter(Boolean)
          .join('\n'),
        { cause: error },
      );
    }
  };
  const scenario = async (entry: string) =>
    JSON.parse((await run([`dist/${entry}.js`])).stdout);
  beforeAll(async () => {
    workspace = await prepareLanguageWorkspace();
    const tsc = join(process.cwd(), 'node_modules/typescript/bin/tsc');
    // Each profile explicitly uses standard decorators; none inherits Nest's config.
    for (const profile of ['core', 'decorators', 'report', 'contracts'])
      await run([tsc, '-p', `tsconfig.${profile}.json`]);
  }, 60000);
  afterAll(async () => {
    await workspace?.close();
  });

  it('merges a plugin event registry while enforcing runtime registration and payload validation', async () => {
    expect(await scenario('core/events.main')).toEqual({
      invoices: [{ invoiceId: 'inv-1', quoteId: 'q-1', totalMinor: '71978' }],
      listeners: 1,
      afterUnsubscribe: 0,
      errors: [
        'Unregistered event: invoice.issued',
        'Invalid event payload: invoice.issued',
      ],
    });
  });
  it('composes versioning and auditing mixins without mutating rejected or independent orders', async () => {
    expect(await scenario('core/mixins.main')).toEqual({
      id: 'po-1',
      state: 'submitted',
      totalMinor: '12000',
      revision: 3,
      audit: [
        { entityId: 'po-1', revision: 2, action: 'line.added' },
        { entityId: 'po-1', revision: 3, action: 'order.submitted' },
      ],
      otherRevision: 1,
      otherAudit: [],
      errors: [
        'Version conflict: po-1',
        'Positive quantity and price required',
        'Submitted orders cannot change',
      ],
    });
  });
  it('loads payment terms with native JSON import attributes in emitted ESM', async () => {
    const source = await readFile(
      join(workspace.directory, 'dist/core/imports.main.js'),
      'utf8',
    );
    expect(source).toMatch(/with\s*\{\s*type:\s*['"]json['"]/);
    expect(await scenario('core/imports.main')).toEqual({
      currency: 'EUR',
      netDays: 30,
      issued: '2026-09-15',
      due: '2026-10-15',
    });
  });
  it('executes standard class, method and auto-accessor decorators without legacy Nest metadata', async () => {
    const source = await readFile(
      join(workspace.directory, 'dist/decorators/approval.js'),
      'utf8',
    );
    expect(source).toContain('__esDecorate');
    expect(source).not.toContain('design:paramtypes');
    expect(await scenario('decorators/main')).toEqual({
      entity: 'purchase-approval',
      receipt: 'approver-1:25000',
      limitMinor: 50000,
      approved: [25000],
      readerApproved: [],
      errors: [
        'Role required: approver',
        'Approval limit must be a positive safe integer',
        'Amount exceeds approval policy',
      ],
    });
  });
  it('compiles TSX using a custom report runtime and validates totals and currencies', async () => {
    expect(await scenario('report/main')).toEqual({
      text: 'Release invoice\nAPI delivery: EUR 120.00\nService fee: EUR 15.00\nTOTAL EUR 135.00',
      errors: [
        'Report total does not match its lines',
        'Mixed report currencies',
        'Report amount must be canonical minor units',
      ],
    });
    expect(
      await readFile(join(workspace.directory, 'dist/report/main.js'), 'utf8'),
    ).toContain('@language/report/jsx-runtime');
  });
  it('disposes real export files and locks on success and cancellation, preserving suppressed failures', async () => {
    const result = await scenario('resources/main');
    expect(result).toMatchObject({
      report: 'Release invoice\nTOTAL EUR 135.00',
      files: ['invoice-1.txt'],
      cancelled: 'Invoice export cancelled',
      duplicate: 'Export is already in progress',
      activeSessions: 0,
      heldLocks: 0,
      suppression: {
        name: 'SuppressedError',
        error: 'Audit cleanup failed',
        suppressed: 'Invoice generation failed',
      },
    });
    expect(result.trace).toEqual([
      'lock:invoice-1',
      'session:open',
      'session:write',
      'session:commit',
      'session:closed',
      'unlock:invoice-1',
      'lock:invoice-2',
      'session:open',
      'session:write',
      'session:closed',
      'unlock:invoice-2',
      'lock:exclusive',
      'unlock:exclusive',
    ]);
  });
});
