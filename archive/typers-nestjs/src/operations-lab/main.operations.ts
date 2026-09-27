import { loadEnvFile } from 'node:process';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
    throw error;
}
const { OperationsLabModule } = await import('./operations-lab.module.js');
const app = await NestFactory.create(OperationsLabModule);
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
app.enableShutdownHooks();
SwaggerModule.setup(
  'docs',
  app,
  SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Inventory operations laboratory')
      .setVersion('1')
      .build(),
  ),
);
await app.listen(Number(process.env.OPERATIONS_PORT ?? 3007), '127.0.0.1');
