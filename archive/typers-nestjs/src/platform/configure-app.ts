import {
  ClassSerializerInterceptor,
  StandardSchemaValidationPipe,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { doubleCsrf } from 'csrf-csrf';
import type { NextFunction, Request, Response } from 'express';

export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  const production = config.get('NODE_ENV') === 'production';
  const sessionSecret =
    config.get<string>('SESSION_SECRET') ?? randomBytes(32).toString('hex');
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN'),
    credentials: true,
  });
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  // MemoryStore is a local demo. Production must select a persistent session store.
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: production },
    }),
  );
  app.useGlobalPipes(
    new StandardSchemaValidationPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.setBaseViewsDir(fileURLToPath(new URL('../views', import.meta.url)));
  app.setViewEngine('hbs');
  const express = app.getHttpAdapter().getInstance();
  const csrf = doubleCsrf({
    getSecret: () => sessionSecret,
    getSessionIdentifier: (req) => req.sessionID,
    cookieName: 'demo-csrf',
    cookieOptions: {
      secure: production,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    },
    getCsrfTokenFromRequest: (req) => req.get('x-csrf-token'),
  });
  express.get('/api/v1/techniques/csrf', (req: Request, res: Response) => {
    (req.session as typeof req.session & { csrfDemo?: boolean }).csrfDemo =
      true;
    res.json({ token: csrf.generateCsrfToken(req, res) });
  });
  express.post('/api/v1/techniques/csrf', (req: Request, res: Response) => {
    if (!csrf.validateRequest(req)) {
      res.status(403).json({ message: 'Invalid CSRF token' });
      return;
    }
    res.json({ accepted: true });
  });
  // Swagger UI needs inline scripts; restrict the CSP exception to its own route.
  express.use('/docs', (_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Typers NestJS laboratory')
      .setVersion('1.0')
      .setDescription(
        'Reference application and executable NestJS documentation examples',
      )
      .addBearerAuth()
      .addTag('fundamentals')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });
  return document;
}
