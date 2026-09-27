import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import type { NextFunction, Request, Response } from 'express';
import {
  operationsConfig,
  ReservationModuleDefinition,
} from './operations.config.js';
import { ReservationEngine } from './reservation-engine.js';
import {
  OperationsCapabilitiesController,
  OperationsController,
} from './operations.controller.js';

@Module({ providers: [ReservationEngine], exports: [ReservationEngine] })
export class ReservationModule extends ReservationModuleDefinition {}

@Module({
  imports: [
    ConfigModule.forFeature(operationsConfig),
    ReservationModule.forRootAsync(operationsConfig.asProvider()),
    ScheduleModule.forRoot(),
  ],
  controllers: [OperationsController, OperationsCapabilitiesController],
  exports: [ReservationModule],
})
export class OperationsLabModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('x-inventory-contract', '2');
        next();
      })
      .forRoutes({
        path: 'operations/summary',
        method: RequestMethod.GET,
        version: '2',
      });
  }
}
