import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReservationPolicy } from './operations.config.js';
import { ReservationEngine } from './reservation-engine.js';
import { HoldReservationDto } from './reservation.dto.js';

@Controller({ path: 'operations', version: '1' })
export class OperationsController {
  constructor(
    private readonly engine: ReservationEngine,
    private readonly config: ConfigService<
      { operations: ReservationPolicy },
      true
    >,
  ) {}

  @Get('summary')
  summaryV1() {
    return { used: this.engine.used };
  }

  @Version(['1', '2'])
  @Post('holds')
  reserve(@Body() input: HoldReservationDto) {
    return this.engine.reserve(input.id, input.units, input.holdMs);
  }

  @Version(['1', '2'])
  @Post('holds/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.engine.confirm(id);
  }

  @Version('2')
  @Get('summary')
  summaryV2() {
    return {
      inventory: {
        used: this.engine.used,
        capacity: this.engine.policy.capacity,
      },
    };
  }

  @Version(['1', '2'])
  @Get('policy')
  policy() {
    return this.config.getOrThrow('operations', { infer: true });
  }

  @Version(VERSION_NEUTRAL)
  @Get('status')
  status() {
    return { status: 'ready' };
  }
}

@Controller('operations-capabilities')
export class OperationsCapabilitiesController {
  @Get()
  capabilities() {
    return { holds: true, scheduling: true };
  }
}
