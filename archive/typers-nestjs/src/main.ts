import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './platform/configure-app.js';

async function bootstrap() {
  if (existsSync('.env')) loadEnvFile('.env');
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApp(app);
  const config = app.get(ConfigService);
  await app.listen(
    config.get<number>('PORT') ?? 3000,
    config.get<string>('HOST') ?? '127.0.0.1',
  );
}
await bootstrap();
