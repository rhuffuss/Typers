import {
  Controller,
  Get,
  Module,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';
import compression from '@fastify/compress';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';

@Controller('adapter')
class FastifyLabController {
  @Get()
  info(@Req() req: FastifyRequest) {
    return { adapter: 'fastify', method: req.method };
  }

  @Post('upload')
  async upload(@Req() req: FastifyRequest) {
    const file = await req.file({ limits: { fileSize: 65536 } });
    if (!file) throw new BadRequestException('file is required');
    return { name: file.filename, bytes: (await file.toBuffer()).length };
  }
}

@Module({ imports: [WorkspacesModule], controllers: [FastifyLabController] })
class FastifyLabModule {}

export async function createFastifyLab() {
  const app = await NestFactory.create<NestFastifyApplication>(
    FastifyLabModule,
    new FastifyAdapter(),
    { logger: false, rawBody: true },
  );
  await app.register(helmet);
  await app.register(compression);
  await app.register(cookie);
  await app.register(multipart);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: 'http://localhost:3000' });
  return app;
}
