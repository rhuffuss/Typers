import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareHmrWorkspace } from '../src/tooling-lab/hmr/prepare-workspace.js';

interface HmrSnapshot {
  message: string;
  pid: number;
  instanceId: string;
  activeInstances: string[];
  destroyedInstances: string[];
  shutdownInstances: string[];
}

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

it('replaces modules twice in the same Node process and awaits the previous Nest lifecycle shutdown', async () => {
  const workspace = await prepareHmrWorkspace();
  const child = spawn(
    process.execPath,
    [
      join(process.cwd(), 'node_modules/@nestjs/cli/bin/nest.js'),
      'build',
      '--config',
      'nest-cli.hmr.json',
      '--watch',
    ],
    {
      cwd: workspace.directory,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '0', FORCE_COLOR: '0' },
    },
  );
  let output = '';
  child.stdout.on('data', (data: Buffer) => {
    output += data.toString();
  });
  child.stderr.on('data', (data: Buffer) => {
    output += data.toString();
  });
  const closed = new Promise<void>((resolve) => {
    child.once('close', () => resolve());
  });
  const signal = (name: NodeJS.Signals) => {
    try {
      if (process.platform === 'win32') child.kill(name);
      else if (child.pid) process.kill(-child.pid, name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  let url: string | undefined;
  async function waitFor(
    message: string,
    timeout = 20000,
  ): Promise<HmrSnapshot> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Webpack exited:\n' + output);
      url ??= output.match(/HMR_URL=(http:\/\/[^\s]+)/)?.[1];
      if (url) {
        try {
          const response = await fetch(url + '/hmr', {
            signal: AbortSignal.timeout(500),
          });
          const body = (await response.json()) as HmrSnapshot;
          if (body.message === message) return body;
        } catch {
          /* HTTP is briefly closed while Nest replaces the instance. */
        }
      }
      await pause(50);
    }
    throw new Error(`HMR did not produce ${message}:\n${output}`);
  }
  try {
    const first = await waitFor('hmr-initial');
    expect(first.activeInstances).toEqual([first.instanceId]);
    expect(first.destroyedInstances).toEqual([]);
    const source = join(workspace.directory, 'src/message.ts');
    const snapshots = [first];
    for (const message of ['hmr-second', 'hmr-third']) {
      await writeFile(
        source,
        (await readFile(source, 'utf8')).replace(
          snapshots.at(-1)!.message,
          message,
        ),
      );
      const updated = await waitFor(message);
      expect(updated.pid).toBe(first.pid);
      expect(updated.instanceId).not.toBe(snapshots.at(-1)!.instanceId);
      expect(updated.activeInstances).toEqual([updated.instanceId]);
      expect(updated.destroyedInstances).toEqual(
        snapshots.map((snapshot) => snapshot.instanceId),
      );
      expect(updated.shutdownInstances).toEqual(
        snapshots.map((snapshot) => snapshot.instanceId),
      );
      snapshots.push(updated);
    }
    expect(output).not.toContain('EADDRINUSE');
  } finally {
    // The compiler, checker and application inherit the test-owned process group.
    signal('SIGTERM');
    await Promise.race([closed, pause(2500)]);
    signal('SIGKILL');
    await closed;
    await workspace.close();
  }
  if (url)
    await expect(
      fetch(url + '/hmr', { signal: AbortSignal.timeout(1000) }),
    ).rejects.toThrow();
}, 60000);
