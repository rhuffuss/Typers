import { randomUUID } from 'node:crypto';
import { Injectable, Module } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';

@Injectable()
export class LazyReportService implements OnModuleInit {
  readonly id = randomUUID();
  private moduleInitCalled = false;

  onModuleInit(): void {
    this.moduleInitCalled = true;
  }

  report() {
    return {
      id: this.id,
      message: 'Provider loaded on demand',
      moduleInitCalled: this.moduleInitCalled,
    };
  }
}

@Module({ providers: [LazyReportService], exports: [LazyReportService] })
export class LazyReportModule {}
