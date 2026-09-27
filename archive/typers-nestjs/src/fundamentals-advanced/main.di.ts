import { createAdvancedDiLab } from './harness.js';

const lab = await createAdvancedDiLab();
await lab.app.listen(Number(process.env.DI_PORT ?? 3008), '127.0.0.1');
console.log(`Advanced DI laboratory: ${await lab.app.getUrl()}/api/di/audit`);
const close = () => {
  void lab.close().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
