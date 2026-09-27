import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwcToolingModule } from './tooling.module.js';

const app = await NestFactory.create(SwcToolingModule, { logger: false });
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 0), '127.0.0.1');
console.log(`TOOLING_URL=${await app.getUrl()}`);
