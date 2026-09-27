import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Security review for the next release' })
  @IsString()
  @Length(3, 160)
  title: string;

  @ApiProperty({
    example: 12000,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    description: 'Amount in integer minor units; 12000 means 120.00.',
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor: number;

  @ApiProperty({ enum: ['EUR', 'USD'], example: 'EUR' })
  @IsIn(['EUR', 'USD'])
  currency: 'EUR' | 'USD';
}

export class ExpenseVersionDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
    description: 'Version returned by the previous read or transition.',
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedVersion: number;
}

export class RejectExpenseDto extends ExpenseVersionDto {
  @ApiProperty({ example: 'Choose a supplier within the project budget.' })
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class PayExpenseDto extends ExpenseVersionDto {
  @ApiProperty({
    example: 'payment-release-2026-001',
    description:
      'Reuse the same key and payload when retrying the same payment.',
  })
  @IsString()
  @Length(8, 128)
  idempotencyKey: string;
}
