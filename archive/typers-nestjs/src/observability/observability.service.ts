import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Counter, Gauge, Summary, TracerService } from '@nestjs/observe';

export const OBSERVE_LAB_OPTIONS = Symbol('OBSERVE_LAB_OPTIONS');
export interface ObserveLabOptions {
  upstreamUrl?: string;
}
type ObserveStore = { feature: string; flags: { manual: boolean } };

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly operations: Counter<'operation'>;
  private readonly active: Gauge;
  private readonly duration: Summary;

  constructor(
    private readonly tracer: TracerService<ObserveStore>,
    @Inject(OBSERVE_LAB_OPTIONS) private readonly options: ObserveLabOptions,
  ) {
    this.operations = tracer.counter('typers.lab.operations', {
      description: 'Completed laboratory operations',
      labels: ['operation'],
    });
    this.active = tracer.gauge('typers.lab.active', {
      description: 'Operations currently running',
      kind: 'additive',
      initialValue: 0,
    });
    this.duration = tracer.summary('typers.lab.duration_ms', {
      description: 'Operation duration in milliseconds',
      sampleSize: 128,
    });
  }

  async work(): Promise<{
    value: number;
    traceId: string | null;
    feature: string | undefined;
    manual: boolean | undefined;
  }> {
    const started = performance.now();
    this.active.increment();
    this.tracer.setAttribute('feature', 'observability-lab');
    this.tracer.setAttribute('flags.manual', true);
    const parent = await this.tracer.activeSpan();
    parent.setTag('lab.entrypoint', 'work');
    try {
      const value: number = await this.tracer.createSpan(
        'lab.compute',
        async (span) => {
          span.addTags({ 'lab.operation': 'sum', 'lab.inputCount': 3 });
          return this.tracer.createSpan('lab.sum', () =>
            [1, 2, 3].reduce((sum, number) => sum + number, 0),
          );
        },
      );
      this.operations.increment({ operation: 'work' });
      return {
        value,
        traceId: this.tracer.currentTraceId(),
        feature: this.tracer.getAttribute('feature'),
        manual: this.tracer.getAttribute('flags.manual'),
      };
    } finally {
      this.active.decrement();
      this.duration.observe(performance.now() - started);
    }
  }

  async handledError() {
    await this.tracer.captureError(new Error('Handled laboratory failure'), {
      retryable: false,
      operation: 'demo',
    });
    return { handled: true, traceId: this.tracer.currentTraceId() };
  }

  fail(): never {
    throw new Error('Unhandled laboratory failure');
  }

  async downstream(): Promise<{ traceId: string | null; downstream: unknown }> {
    if (!this.options.upstreamUrl)
      throw new BadRequestException('OBSERVE_UPSTREAM_URL is not configured');
    const traceId = this.tracer.currentTraceId();
    const downstream: unknown = await this.tracer.createSpan(
      'lab.http.downstream',
      async (span) => {
        span.setTag('protocol', 'http');
        const response = await fetch(this.options.upstreamUrl!, {
          headers: traceId ? { 'x-request-id': traceId } : {},
          signal: AbortSignal.timeout(2000),
        });
        if (!response.ok)
          throw new Error(`Upstream returned ${response.status}`);
        return response.json();
      },
    );
    return { traceId, downstream };
  }

  log() {
    // Deliberately fictitious values exercise SDK redaction before ingestion.
    this.logger.log(
      'Observe redaction demo internalToken=observe-local-secret authorization=Bearer demo-local-token',
    );
    return { logged: true, traceId: this.tracer.currentTraceId() };
  }
}
