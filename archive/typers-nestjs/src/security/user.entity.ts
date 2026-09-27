import { Exclude } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Role } from './role.enum.js';

export class UserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'admin@typers.local' })
  email: string;

  @ApiProperty({ example: 'Demo administrator' })
  name: string;

  @ApiProperty({ enum: Role, enumName: 'Role', isArray: true })
  roles: Role[];

  @Exclude()
  @ApiHideProperty()
  passwordHash: string;

  constructor(user: {
    id: string;
    email: string;
    name: string;
    roles: Role[];
    passwordHash: string;
  }) {
    Object.assign(this, user);
  }
}
