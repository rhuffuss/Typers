import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiHideProperty } from '@nestjs/swagger';

// Intentionally no ApiProperty: the CLI plugin must infer these properties.
export class CatalogEntryDto {
  /** Public entry title. */
  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  revision!: number;

  @IsOptional()
  @IsString()
  summary?: string;

  @ApiHideProperty()
  secret!: string;
}
