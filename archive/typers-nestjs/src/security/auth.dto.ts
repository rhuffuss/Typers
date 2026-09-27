import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { UserEntity } from './user.entity.js';

export class LoginDto {
  @ApiProperty({ example: 'admin@typers.local' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'TypersDemo-Admin-2026!',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class LoginResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty({ example: 'Bearer' })
  token_type: string;

  @ApiProperty({ example: 900 })
  expires_in: number;

  @ApiProperty({ type: () => UserEntity })
  user: UserEntity;
}
