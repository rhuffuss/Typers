import 'reflect-metadata';
import { Body, Controller, Get, HttpException, Injectable, Module, Param, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Err, None, Ok, Some, fromNullable, type Option, type Result } from '@typers/core';

export type ReservationError =
  | { readonly code: 'INVALID_INPUT'; readonly field: string }
  | { readonly code: 'UNKNOWN_SKU'; readonly sku: string }
  | { readonly code: 'INSUFFICIENT_STOCK'; readonly sku: string; readonly available: number };

export interface ReservationInput {
  readonly sku: string;
  readonly units: number;
  readonly note: Option<string>;
}

export interface Reservation {
  readonly id: string;
  readonly sku: string;
  readonly units: number;
  readonly remaining: number;
  readonly note: Option<string>;
}

function invalid(field: string): Result<never, ReservationError> {
  return Err({ code: 'INVALID_INPUT', field });
}

export function parseReservation(input: unknown): Result<ReservationInput, ReservationError> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return invalid('body');
  if (!('sku' in input) || typeof input.sku !== 'string' || !/^[A-Z][A-Z0-9-]*$/.test(input.sku)) return invalid('sku');
  if (!('units' in input) || typeof input.units !== 'number' || !Number.isSafeInteger(input.units) || input.units <= 0) return invalid('units');
  let note: Option<string> = None;
  const candidate = fromNullable('note' in input ? input.note : undefined);
  if let Some(value) = candidate {
    if (typeof value !== 'string' || value.length > 120) return invalid('note');
    note = Some(value);
  }
  return Ok({ sku: input.sku, units: input.units, note });
}

@Injectable()
export class StockRepository {
  readonly #stock = new Map<string, number>([['WIDGET', 4], ['EMPTY', 0]]);
  #lookups = 0;
  get lookups(): number { return this.#lookups; }

  find(sku: string): Option<number> {
    this.#lookups++;
    return fromNullable(this.#stock.get(sku));
  }

  save(sku: string, remaining: number): void { this.#stock.set(sku, remaining); }
}

@Injectable()
export class ReservationsService {
  #sequence = 0;

  // No explicit @Inject token: emitted design:paramtypes must make class DI work.
  constructor(private readonly stock: StockRepository) {}

  reserve(input: unknown): Result<Reservation, ReservationError> {
    const parsed = parseReservation(input);
    if (parsed.kind === 'err') return parsed;
    const request = parsed.value;
    if let Some(available) = this.stock.find(request.sku) {
      if (request.units > available) return Err({ code: 'INSUFFICIENT_STOCK', sku: request.sku, available });
      const remaining = available - request.units;
      this.stock.save(request.sku, remaining);
      return Ok({ id: `reservation-${++this.#sequence}`, sku: request.sku, units: request.units, remaining, note: request.note });
    } else {
      return Err({ code: 'UNKNOWN_SKU', sku: request.sku });
    }
  }
}

@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService, private readonly stock: StockRepository) {}

  @Get('stock/:sku')
  stockFor(@Param('sku') sku: string): Option<number> {
    const option = this.stock.find(sku);
    if let Some(available) = option { return Some(available); }
    else { throw new HttpException({ code: 'UNKNOWN_SKU', sku }, 404); }
  }

  @Post('reservations')
  reserve(@Body() body: unknown): Reservation {
    const result = this.reservations.reserve(body);
    if (result.kind === 'ok') return result.value;
    const error = result.error;
    const status = error.code === 'INVALID_INPUT' ? 400 : error.code === 'UNKNOWN_SKU' ? 404 : 409;
    throw new HttpException(error, status);
  }
}

@Module({ controllers: [ReservationsController], providers: [StockRepository, ReservationsService] })
export class ReservationsModule {}

export async function createDemoApp(port = 0) {
  const app = await NestFactory.create(ReservationsModule, { logger: false });
  await app.listen(port, '127.0.0.1');
  return app;
}
