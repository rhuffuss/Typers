import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Catch, Injectable, ValidationPipe } from '@nestjs/common';
import type {
  ArgumentMetadata,
  ArgumentsHost,
  CallHandler,
  CanActivate,
  ExecutionContext,
  INestMicroservice,
  NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { RpcExceptionFilter } from '@nestjs/common';
import { Observable, map, throwError } from 'rxjs';

export interface RpcTrace {
  correlationId: string;
  stages: string[];
}

export const rpcTrace = new AsyncLocalStorage<RpcTrace>();

export function registerRpcHooks(app: INestMicroservice): void {
  app.registerPreRequestHook(
    (context, next) =>
      new Observable((subscriber) => {
        const payload = context
          .switchToRpc()
          .getData<{ correlationId?: unknown }>();
        const correlationId =
          typeof payload?.correlationId === 'string'
            ? payload.correlationId.slice(0, 80)
            : randomUUID();
        return rpcTrace.run({ correlationId, stages: ['hook:context'] }, () =>
          next().subscribe(subscriber),
        );
      }),
  );
  app.registerPreRequestHook((_context, next) => {
    rpcTrace.getStore()?.stages.push('hook:second');
    return next();
  });
}

@Injectable()
export class RpcDemoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    rpcTrace.getStore()?.stages.push('guard');
    if (
      context.switchToRpc().getData<{ authorized?: boolean }>()?.authorized ===
      false
    ) {
      throw new RpcException('ACCESS_DENIED');
    }
    return true;
  }
}

@Injectable()
export class RpcDemoPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () => new RpcException('VALIDATION_FAILED'),
    });
  }

  override transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (metadata.type !== 'custom') rpcTrace.getStore()?.stages.push('pipe');
    return super.transform(value, metadata) as Promise<unknown>;
  }
}

@Injectable()
export class RpcDemoInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    rpcTrace.getStore()?.stages.push('interceptor:before');
    return next.handle().pipe(
      map((value: unknown) => {
        const trace = rpcTrace.getStore();
        if (value && typeof value === 'object' && 'result' in value) {
          return {
            ...value,
            correlationId: trace?.correlationId,
            stages: [...(trace?.stages ?? []), 'interceptor:after'],
          };
        }
        return value;
      }),
    );
  }
}

@Catch(RpcException)
export class RpcDemoFilter implements RpcExceptionFilter<RpcException> {
  catch(exception: RpcException, _host: ArgumentsHost): Observable<never> {
    return throwError(() => ({
      code: 'DEMO_RPC_ERROR',
      message: exception.getError(),
    }));
  }
}
