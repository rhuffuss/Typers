import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { DemoRequest } from './fundamentals.tokens.js';

@Injectable()
export class SingletonProbe {
  readonly id = randomUUID();
}

@Injectable({ scope: Scope.REQUEST })
export class RequestProbe {
  readonly id = randomUUID();

  constructor(@Inject(REQUEST) readonly request: DemoRequest) {}
}

@Injectable({ scope: Scope.TRANSIENT })
export class TransientProbe {
  readonly id = randomUUID();
}

@Injectable()
export class FirstConsumer {
  constructor(readonly transient: TransientProbe) {}
}

@Injectable()
export class SecondConsumer {
  constructor(readonly transient: TransientProbe) {}
}

// Created through ModuleRef.create(), deliberately absent from providers[].
@Injectable()
export class AdHocProbe {
  constructor(readonly singleton: SingletonProbe) {}
}
