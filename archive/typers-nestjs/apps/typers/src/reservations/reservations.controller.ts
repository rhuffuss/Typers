import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  DomainErrorResponse,
  ReservationRequest,
  ReservationResponse,
} from '../http/api-contracts.js';
import { domainException, respond } from '../http/domain-result.js';
import type { Reservation } from './reservation.js';
import { ReservationsService } from './reservations.service.js';
import type { Result, Option } from '@typers/core';

@ApiTags('Reservas')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Reservar stock: Result y repetición idempotente' })
  @ApiBody({ type: ReservationRequest })
  @ApiCreatedResponse({ type: ReservationResponse })
  @ApiBadRequestResponse({ type: DomainErrorResponse })
  @ApiNotFoundResponse({ type: DomainErrorResponse })
  @ApiConflictResponse({ type: DomainErrorResponse })
  create(@Body() input: unknown): Reservation {
    return respond(this.reservations.reserve(input));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Recuperar una reserva: if let Some y ausencia explícita',
  })
  @ApiOkResponse({ type: ReservationResponse })
  @ApiNotFoundResponse({ type: DomainErrorResponse })
  find(@Param('id') id: string): Option<Reservation> {
    this.reservations.find(id)).
  }
}
vitest.config.ts