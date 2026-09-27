import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<{ requestId: string }>();

  run(requestId: string, callback: () => void) {
    this.storage.run({ requestId }, callback);
  }

  get requestId() {
    return this.storage.getStore()?.requestId;
  }
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContext) {}

  use(_req: Request, res: Response, next: NextFunction) {
    const requestId = randomUUID();
    res.setHeader('x-request-id', requestId);
    this.context.run(requestId, next);
  }
}
