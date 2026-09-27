import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// These explicit Swagger decorators document HTTP. Domain parsers validate unknown input.
// Swagger uses these decorators and Typers-emitted metadata; no compiler plugin is required.
export class ProductResponse {
  @ApiProperty({ example: 'WIDGET' })
  sku!: string;

  @ApiProperty({ example: 'Widget' })
  name!: string;

  @ApiProperty({
    example: '1001',
    description: 'Céntimos como string; el cálculo usa BigInt.',
  })
  unitPriceMinor!: string;

  @ApiProperty({ enum: ['EUR'] })
  currency!: string;

  @ApiProperty({ example: 4, minimum: 0 })
  stock!: number;
}

export class QuoteRequest {
  @ApiProperty({ example: 'WIDGET' })
  sku!: string;

  @ApiProperty({ example: 2, minimum: 1, type: 'integer' })
  quantity!: number;

  @ApiPropertyOptional({
    enum: ['SAVE10', 'ZERO'],
    nullable: true,
    example: 'SAVE10',
    description:
      'SAVE10 descuenta 10%; ZERO conserva un descuento presente de 0%; null/ausencia = None.',
  })
  coupon?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Recoger en almacén',
    description:
      'Una nota ausente se representa con Option.None dentro del dominio.',
  })
  note?: string | null;
}

export class ReservationRequest extends QuoteRequest {
  @ApiProperty({
    example: 'order-demo-1',
    description:
      'Repetir la misma petición con esta clave devuelve la reserva existente.',
  })
  idempotencyKey!: string;
}

export class QuoteResponse {
  @ApiProperty({ example: 'WIDGET' })
  sku!: string;

  @ApiProperty({ example: 2, type: 'integer' })
  quantity!: number;

  @ApiProperty({ enum: ['EUR'] })
  currency!: string;

  @ApiProperty({ example: '1001' })
  unitPriceMinor!: string;

  @ApiProperty({ example: '2002' })
  subtotalMinor!: string;

  @ApiProperty({ example: '200' })
  discountMinor!: string;

  @ApiProperty({ example: '1802' })
  totalMinor!: string;

  @ApiProperty({ type: String, nullable: true, example: 'SAVE10' })
  coupon!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 10 })
  discountPercent!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'Recoger en almacén' })
  note!: string | null;
}

export class ReservationResponse {
  @ApiProperty({ example: 'reservation-1' })
  id!: string;

  @ApiProperty({ type: QuoteResponse })
  quote!: QuoteResponse;

  @ApiProperty({ example: 'order-demo-1' })
  idempotencyKey!: string;

  @ApiProperty({ enum: ['confirmed'] })
  status!: string;

  @ApiProperty({ example: 2, minimum: 0 })
  remainingStock!: number;
}

export class DomainErrorResponse {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    enum: [
      'INVALID_INPUT',
      'PRODUCT_NOT_FOUND',
      'RESERVATION_NOT_FOUND',
      'INVALID_COUPON',
      'INSUFFICIENT_STOCK',
      'IDEMPOTENCY_CONFLICT',
    ],
  })
  code!: string;

  @ApiProperty({ example: 'Not enough stock available' })
  message!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, string | number>;
}
