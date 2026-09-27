import { Catch, Injectable, ValidationPipe } from '@nestjs/common';
import type {
  ArgumentsHost,
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
  WsExceptionFilter,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WebSocket } from 'ws';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

@Injectable()
export class SocketDemoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (
      context.switchToWs().getData<{ authorized?: boolean }>()?.authorized ===
      false
    ) {
      throw new WsException('ACCESS_DENIED');
    }
    return true;
  }
}

export const socketValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: () => new WsException('VALIDATION_FAILED'),
});

@Catch(WsException)
export class SocketDemoFilter implements WsExceptionFilter<WsException> {
  catch(exception: WsException, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket | WebSocket>();
    const data = { code: 'DEMO_WS_ERROR', message: exception.getError() };
    if (client instanceof WebSocket)
      client.send(JSON.stringify({ event: 'exception', data }));
    else client.emit('exception', data);
  }
}

@Injectable()
export class SocketDemoInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (!value || typeof value !== 'object') return value;
        if (
          'event' in value &&
          'data' in value &&
          typeof value.data === 'object'
        ) {
          return { ...value, data: { ...value.data, intercepted: true } };
        }
        return { ...value, intercepted: true };
      }),
    );
  }
}

@Injectable()
export class GatewayLifecycle {
  initialized = false;
  connections = 0;
  disconnections = 0;
}
