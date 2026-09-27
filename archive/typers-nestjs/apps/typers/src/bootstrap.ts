import 'reflect-metadata';
import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppModule } from './app.module.js';

export interface ApplicationOptions {
  readonly logger?: NestApplicationOptions['logger'];
}

/** Creates a real Nest application without opening a socket. */
export async function createApplication(options: ApplicationOptions = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: options.logger ?? ['error', 'warn', 'log'],
    abortOnError: false,
  });

  try {
    app.setGlobalPrefix('api');
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Commerce · Typers + NestJS')
        .setDescription(
          'Aplicación NestJS compilada con Typers: catálogo, presupuestos y reservas. ' +
            'Result representa éxito o error; Option representa presencia o ausencia; ' +
            'if let Some extrae valores en servicios y controladores. Datos en memoria.',
        )
        .setVersion('0.1.0')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: '/openapi.json',
      swaggerOptions: { displayRequestDuration: true },
    });
    app
      .getHttpAdapter()
      .getInstance()
      .get('/', (_request: Request, response: Response) => {
        response.redirect('/docs');
      });
    app.enableShutdownHooks();
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
