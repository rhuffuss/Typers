import { createFastifyLab } from './fastify-lab.js';
const app = await createFastifyLab();
app.enableShutdownHooks();
await app.listen(
  Number(process.env.PORT ?? 3001),
  process.env.HOST ?? '127.0.0.1',
);
