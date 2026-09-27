import 'reflect-metadata';
import { createObservabilityApp } from './observability.harness.js';

const appKey = process.env.OBSERVE_APP_KEY;
const appSecret = process.env.OBSERVE_APP_SECRET;
if (!appKey || !appSecret)
  throw new Error(
    'Set OBSERVE_APP_KEY and OBSERVE_APP_SECRET before explicitly starting this optional laboratory',
  );
const app = await createObservabilityApp({
  appKey,
  appSecret,
  endpoint: process.env.OBSERVE_ENDPOINT ?? 'https://observe-api.nestjs.com',
  serviceId: process.env.OBSERVE_SERVICE_ID ?? 'typers-nestjs-lab',
  serviceVersion: process.env.OBSERVE_SERVICE_VERSION ?? 'development',
  upstreamUrl: process.env.OBSERVE_UPSTREAM_URL,
  runtimeMetrics: true,
});
await app.listen(Number(process.env.OBSERVE_PORT ?? 3020), '127.0.0.1');
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 5000);
  try {
    await app.close();
    clearTimeout(timeout);
    // See docs/observability.md for the SDK 0.2.0 worker lifecycle limitation.
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
