import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class HoldReservationDto {
  @ApiProperty({ example: 'workshop-seats', pattern: '^[a-z0-9-]{1,40}$' })
  @Matches(/^[a-z0-9-]{1,40}$/)
  id: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  units: number;

  @ApiPropertyOptional({ example: 30000, minimum: 1, maximum: 3600000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600000)
  holdMs?: number;
}
