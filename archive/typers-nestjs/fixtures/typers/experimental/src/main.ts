import { createDemoApp } from './nest-app.js';

const app = await createDemoApp(Number(process.env.PORT ?? 3014));
console.log(`Typers reservations demo: ${await app.getUrl()}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
