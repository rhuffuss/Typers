import { createApplication } from './bootstrap.js';

// Validate before creating Nest so a bad setting cannot leave an initialized app.
const configuredPort = process.env.PORT ?? '3014';
if (!/^\d+$/.test(configuredPort)) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
const port = Number(configuredPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const app = await createApplication();
try {
  await app.listen(port, '127.0.0.1');
  console.log(`Typers NestJS: http://127.0.0.1:${port}/docs`);
} catch (error) {
  await app.close();
  throw error;
}
