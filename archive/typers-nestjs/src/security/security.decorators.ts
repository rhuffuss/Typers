import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role, ROLES_KEY } from './role.enum.js';
import { JwtAuthGuard, RolesGuard } from './security.guards.js';
import type { UserEntity } from './user.entity.js';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (field: keyof UserEntity | undefined, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<{ user: UserEntity }>().user;
    return field ? user?.[field] : user;
  },
);

export function Auth(...roles: Role[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing, invalid, or expired bearer token',
    }),
    ApiForbiddenResponse({
      description: 'The user does not have an allowed role',
    }),
  );
}
