import { Catch, HttpException, Injectable, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
@Injectable()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body =
      error instanceof HttpException
        ? error.getResponse()
        : { message: 'Internal server error' };
    if (status === 500)
      this.logger.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    this.adapterHost.httpAdapter.reply(
      context.getResponse(),
      {
        ...(typeof body === 'string' ? { message: body } : body),
        statusCode: status,
      },
      status,
    );
  }
}
