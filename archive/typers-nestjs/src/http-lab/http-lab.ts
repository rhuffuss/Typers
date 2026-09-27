import { AsyncLocalStorage } from 'node:async_hooks';
import {
  Catch,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
  Version,
  VersioningType,
} from '@nestjs/common';
import type {
  ArgumentsHost,
  CallHandler,
  CanActivate,
  ExceptionFilter,
  ExecutionContext,
  MiddlewareConsumer,
  NestInterceptor,
  NestMiddleware,
  NestModule,
  PipeTransform,
  VersioningOptions,
} from '@nestjs/common';
import {
  APP_GUARD,
  APP_INTERCEPTOR,
  APP_PIPE,
  NestFactory,
  RouterModule,
} from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  Cron,
  CronExpression,
  Interval,
  ScheduleModule,
  Timeout,
} from '@nestjs/schedule';
import type { NextFunction, Request, Response } from 'express';
import { map } from 'rxjs';
import compression from 'compression';

@Injectable()
export class TraceRecorder {
  readonly context = new AsyncLocalStorage<string[]>();
  push(value: string) {
    this.context.getStore()?.push(value);
  }
  get values() {
    return this.context.getStore() ?? [];
  }
}

@Injectable()
class TraceMiddleware implements NestMiddleware {
  constructor(private readonly recorder: TraceRecorder) {}
  use(_req: Request, _res: Response, next: NextFunction) {
    this.recorder.context.run(['middleware'], next);
  }
}
@Injectable()
class GlobalGuard implements CanActivate {
  constructor(private readonly recorder: TraceRecorder) {}
  canActivate() {
    this.recorder.push('global-guard');
    return true;
  }
}
@Injectable()
class LocalGuard implements CanActivate {
  constructor(private readonly recorder: TraceRecorder) {}
  canActivate() {
    this.recorder.push('local-guard');
    return true;
  }
}
@Injectable()
class GlobalInterceptor implements NestInterceptor {
  constructor(private readonly recorder: TraceRecorder) {}
  intercept(_context: ExecutionContext, next: CallHandler) {
    this.recorder.push('global-interceptor:before');
    return next.handle().pipe(
      map((value: unknown) => {
        this.recorder.push('global-interceptor:after');
        return value;
      }),
    );
  }
}
@Injectable()
class LocalInterceptor implements NestInterceptor {
  constructor(private readonly recorder: TraceRecorder) {}
  intercept(_context: ExecutionContext, next: CallHandler) {
    this.recorder.push('local-interceptor:before');
    return next.handle().pipe(
      map((value: unknown) => {
        this.recorder.push('local-interceptor:after');
        return value;
      }),
    );
  }
}
@Injectable()
class GlobalPipe implements PipeTransform {
  constructor(private readonly recorder: TraceRecorder) {}
  transform(value: unknown) {
    this.recorder.push('global-pipe');
    return value;
  }
}
@Injectable()
class LocalPipe implements PipeTransform {
  constructor(private readonly recorder: TraceRecorder) {}
  transform(value: string) {
    this.recorder.push('local-pipe');
    return value.toUpperCase();
  }
}
@Catch()
class TraceFilter implements ExceptionFilter {
  constructor(private readonly recorder: TraceRecorder) {}
  catch(_error: unknown, host: ArgumentsHost) {
    this.recorder.push('filter');
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(500)
      .json({ trace: this.recorder.values });
  }
}

@Controller('lifecycle')
@UseGuards(LocalGuard)
@UseInterceptors(LocalInterceptor)
@UseFilters(TraceFilter)
class LifecycleController {
  constructor(private readonly recorder: TraceRecorder) {}
  @Get('error')
  error(): never {
    this.recorder.push('handler');
    throw new Error('Expected fixture failure');
  }
  @Get(':value')
  @UsePipes(LocalPipe)
  run(@Param('value') value: string) {
    this.recorder.push('handler');
    return { value, trace: this.recorder.values };
  }
}
@Controller('leaf')
class NestedController {
  @Get() leaf() {
    return { nested: true };
  }
}
@Module({ controllers: [NestedController] })
class NestedModule {}
@Module({ imports: [NestedModule] })
class ParentModule {}

@Injectable()
export class ScheduleProbe {
  intervals = 0;
  timeouts = 0;
  crons = 0;
  @Interval('probe-interval', 25) onInterval() {
    this.intervals++;
  }
  @Timeout('probe-timeout', 10) onTimeout() {
    this.timeouts++;
  }
  @Cron(CronExpression.EVERY_SECOND, { name: 'probe-cron' }) onCron() {
    this.crons++;
  }
}
@Controller()
class HttpFeaturesController {
  @Version('1') @Get('version') v1() {
    return { version: 1 };
  }
  @Version('2') @Get('version') v2() {
    return { version: 2 };
  }
  @Get('large') large() {
    return 'NestJS '.repeat(2000);
  }
}

@Module({
  imports: [
    ParentModule,
    RouterModule.register([
      {
        path: 'outer',
        module: ParentModule,
        children: [{ path: 'inner', module: NestedModule }],
      },
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [LifecycleController, HttpFeaturesController],
  providers: [
    TraceRecorder,
    TraceMiddleware,
    LocalGuard,
    LocalInterceptor,
    LocalPipe,
    TraceFilter,
    ScheduleProbe,
    { provide: APP_GUARD, useClass: GlobalGuard },
    { provide: APP_INTERCEPTOR, useClass: GlobalInterceptor },
    { provide: APP_PIPE, useClass: GlobalPipe },
  ],
})
export class HttpLabModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes(LifecycleController);
  }
}

export async function createHttpLab(versioning?: VersioningOptions) {
  const app = await NestFactory.create<NestExpressApplication>(HttpLabModule, {
    logger: false,
  });
  if (versioning) app.enableVersioning(versioning);
  app.use(compression());
  app.enableCors({ origin: 'http://demo.local', methods: ['GET', 'POST'] });
  await app.listen(0, '127.0.0.1');
  return app;
}
export { VersioningType };
