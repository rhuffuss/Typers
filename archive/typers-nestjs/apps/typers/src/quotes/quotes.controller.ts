import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  DomainErrorResponse,
  QuoteRequest,
  QuoteResponse,
} from '../http/api-contracts.js';
import { respond } from '../http/domain-result.js';
import type { Quote } from './quote.js';
import { QuotesService } from './quotes.service.js';

@ApiTags('Presupuestos')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Calcular un presupuesto: Result de validación, precio y cupón opcional',
  })
  @ApiBody({ type: QuoteRequest })
  @ApiOkResponse({ type: QuoteResponse })
  @ApiBadRequestResponse({ type: DomainErrorResponse })
  @ApiNotFoundResponse({ type: DomainErrorResponse })
  create(@Body() input: unknown): Quote {
    return respond(this.quotes.quote(input));
  }
}
