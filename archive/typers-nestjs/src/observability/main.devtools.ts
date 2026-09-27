import 'reflect-metadata';
import { createDevtoolsApp } from './devtools.harness.js';

const app = await createDevtoolsApp({
  http: process.env.DEVTOOLS_HTTP === '1',
  port: Number(process.env.DEVTOOLS_PORT ?? 8000),
});
app.enableShutdownHooks();
await app.listen(Number(process.env.DEVTOOLS_APP_PORT ?? 3021), '127.0.0.1');
