import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SumMessage {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @IsInt({ each: true })
  values!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  correlationId?: string;

  @IsOptional()
  @IsBoolean()
  authorized?: boolean;
}

export class CreatedMessage {
  @IsUUID()
  id!: string;

  @IsString()
  @MaxLength(100)
  value!: string;
}

export class SocketMessage {
  @IsString()
  @MaxLength(100)
  text!: string;

  @IsOptional()
  @IsBoolean()
  authorized?: boolean;
}
