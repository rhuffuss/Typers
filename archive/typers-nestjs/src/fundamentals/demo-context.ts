import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type { DemoRequest } from './fundamentals.tokens.js';

export const DemoAccess = Reflector.createDecorator<
  'public' | 'acknowledged'
>();

@Injectable()
export class DemoContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return false;
    const access = this.reflector.getAllAndOverride(DemoAccess, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (access !== 'acknowledged') return true;
    const request = context.switchToHttp().getRequest<DemoRequest>();
    return request.headers['x-demo-access'] === 'acknowledged';
  }
}

export interface DemoEnvelope<T> {
  readonly data: T;
  readonly context: {
    readonly transport: string;
    readonly controller: string;
    readonly handler: string;
    readonly access: string;
  };
}

@Injectable()
export class DemoContextInterceptor<T> implements NestInterceptor<
  T,
  DemoEnvelope<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<DemoEnvelope<T>> {
    const access =
      this.reflector.getAllAndOverride(DemoAccess, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'public';
    return next.handle().pipe(
      map((data) => ({
        data,
        context: {
          transport: context.getType(),
          controller: context.getClass().name,
          handler: context.getHandler().name,
          access,
        },
      })),
    );
  }
}
