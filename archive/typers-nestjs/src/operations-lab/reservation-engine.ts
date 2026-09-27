import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronTime } from 'cron';
import { RESERVATION_POLICY } from './operations.config.js';
import type { ReservationPolicy } from './operations.config.js';

export interface Reservation {
  readonly id: string;
  readonly units: number;
  readonly expiresAt: number;
  readonly status: 'held' | 'confirmed' | 'expired';
}

/** Process-local inventory holds. Timers and cron share the same idempotent transition. */
@Injectable()
export class ReservationEngine {
  readonly #reservations = new Map<string, Reservation>();
  readonly #samples: number[] = [];
  #sweepRuns = 0;

  constructor(
    @Inject(RESERVATION_POLICY) readonly policy: ReservationPolicy,
    private readonly registry: SchedulerRegistry,
  ) {}

  get used() {
    return this.list().reduce(
      (total, reservation) =>
        total + (reservation.status === 'expired' ? 0 : reservation.units),
      0,
    );
  }

  list(): readonly Reservation[] {
    return [...this.#reservations.values()].map((item) => ({ ...item }));
  }

  reserve(id: string, units: number, holdMs = this.policy.holdMs): Reservation {
    if (
      !/^[a-z0-9-]{1,40}$/.test(id) ||
      !Number.isSafeInteger(units) ||
      units < 1 ||
      !Number.isSafeInteger(holdMs) ||
      holdMs < 1 ||
      holdMs > this.policy.holdMs
    ) {
      throw new BadRequestException(
        'Invalid reservation, units or hold duration',
      );
    }
    this.sweep();
    if (this.#reservations.has(id)) {
      throw new ConflictException('Reservation identifiers cannot be reused');
    }
    if (this.#reservations.size >= 1000) {
      throw new ConflictException(
        'This in-memory lab retains at most 1000 reservations',
      );
    }
    if (this.used + units > this.policy.capacity) {
      throw new ConflictException('Insufficient inventory');
    }
    const reservation: Reservation = {
      id,
      units,
      expiresAt: Date.now() + holdMs,
      status: 'held',
    };
    const name = this.timeoutName(id);
    const timeout = setTimeout(() => this.expire(id), holdMs);
    try {
      this.registry.addTimeout(name, timeout);
      this.#reservations.set(id, reservation);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
    return { ...reservation };
  }

  confirm(id: string): Reservation {
    this.sweep();
    const reservation = this.#reservations.get(id);
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== 'held') {
      throw new ConflictException('Only an unexpired hold can be confirmed');
    }
    this.cancelTimeout(id);
    const confirmed: Reservation = { ...reservation, status: 'confirmed' };
    this.#reservations.set(id, confirmed);
    return { ...confirmed };
  }

  sweep() {
    for (const item of this.#reservations.values()) {
      if (item.status === 'held' && item.expiresAt <= Date.now())
        this.expire(item.id);
    }
  }

  startSweep(expression: string = CronExpression.EVERY_SECOND) {
    const name = 'operations:sweep';
    if (this.registry.doesExist('cron', name)) {
      throw new ConflictException('The inventory sweep already exists');
    }
    const job = CronJob.from({
      cronTime: expression,
      timeZone: 'UTC',
      waitForCompletion: true,
      onTick: () => {
        this.#sweepRuns++;
        this.sweep();
      },
    });
    this.registry.addCronJob(name, job);
    job.start();
  }

  rescheduleSweep(expression: string) {
    // Validate before touching the running job, so bad input preserves its schedule.
    const schedule = new CronTime(expression, 'UTC');
    this.registry.getCronJob('operations:sweep').setTime(schedule);
  }

  stopSweep() {
    if (this.registry.doesExist('cron', 'operations:sweep')) {
      this.registry.deleteCronJob('operations:sweep');
    }
  }

  startSampling(milliseconds: number) {
    if (
      !Number.isSafeInteger(milliseconds) ||
      milliseconds < 10 ||
      milliseconds > 60000
    ) {
      throw new BadRequestException(
        'Sampling interval must be in 10..60000 ms',
      );
    }
    const timer = setInterval(() => {
      this.sweep();
      this.#samples.push(this.used);
      if (this.#samples.length > 8) this.#samples.shift();
    }, milliseconds);
    try {
      this.registry.addInterval('operations:capacity', timer);
    } catch (error) {
      clearInterval(timer);
      throw error;
    }
  }

  stopSampling() {
    if (this.registry.doesExist('interval', 'operations:capacity')) {
      this.registry.deleteInterval('operations:capacity');
    }
  }

  metrics() {
    return {
      sweepRuns: this.#sweepRuns,
      samples: [...this.#samples],
      used: this.used,
    };
  }

  private expire(id: string) {
    const item = this.#reservations.get(id);
    if (!item || item.status !== 'held') return;
    this.#reservations.set(id, { ...item, status: 'expired' });
    this.cancelTimeout(id);
  }

  private cancelTimeout(id: string) {
    const name = this.timeoutName(id);
    if (this.registry.doesExist('timeout', name))
      this.registry.deleteTimeout(name);
  }

  private timeoutName(id: string) {
    return `operations:hold:${id}`;
  }
}
