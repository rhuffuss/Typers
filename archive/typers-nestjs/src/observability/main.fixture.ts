import 'reflect-metadata';
import { createObservabilityApp } from './observability.harness.js';
import { createDevtoolsApp } from './devtools.harness.js';

const endpoint = process.env.OBSERVE_TEST_ENDPOINT;
if (!endpoint || new URL(endpoint).hostname !== '127.0.0.1') {
  throw new Error(
    'The observability test fixture requires a 127.0.0.1 collector',
  );
}
const devtools = await createDevtoolsApp();
await devtools.listen(0, '127.0.0.1');
const app = await createObservabilityApp({
  appKey: 'local-test-key',
  appSecret: 'local-test-secret',
  serviceId: 'typers-observe-test',
  serviceVersion: 'test',
  endpoint,
  upstreamUrl: `${endpoint}/upstream`,
  runtimeMetrics: true,
  runtimeMetricsInterval: 30000,
  flushInterval: 1000,
});
await app.listen(0, '127.0.0.1');
process.send?.({
  type: 'ready',
  url: await app.getUrl(),
  devtoolsUrl: await devtools.getUrl(),
});

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 4000);
  try {
    await devtools.close();
    await app.close();
    process.send?.({ type: 'closed' });
    // SDK 0.2.0 restarts its worker on terminate's exit code 1. The parent
    // records that behavior; process exit bounds this isolated fixture's life.
    setTimeout(() => {
      clearTimeout(timeout);
      process.exit(0);
    }, 100);
  } catch (error) {
    process.send?.({ type: 'close-error', error: String(error) });
    process.exit(1);
  }
}
process.on('message', (message: unknown) => {
  if (message === 'close') void close();
});
process.on('SIGTERM', () => {
  void close();
});
process.on('SIGINT', () => {
  void close();
});
