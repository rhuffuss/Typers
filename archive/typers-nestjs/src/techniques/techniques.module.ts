import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import {
  ActivityLog,
  ActivityRequestedHandler,
  ActivitySagas,
  ReadActivityHandler,
  RecordActivityHandler,
} from './activity.js';
import { RequestContext, RequestContextMiddleware } from './request-context.js';
import { TechniquesController } from './techniques.controller.js';
import { HttpErrorFilter } from '../platform/http-error.filter.js';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register({ ttl: 1000 }),
    HttpModule.register({ timeout: 1500 }),
    CqrsModule.forRoot(),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [TechniquesController],
  providers: [
    ActivityLog,
    ActivityRequestedHandler,
    ActivitySagas,
    ReadActivityHandler,
    RecordActivityHandler,
    RequestContext,
    RequestContextMiddleware,
    HttpErrorFilter,
  ],
  exports: [ActivityLog, RequestContext],
})
export class TechniquesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes(TechniquesController);
  }
}
