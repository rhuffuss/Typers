import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto, LoginResponseDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { DemoUsersService } from './demo-users.service.js';
import { Role } from './role.enum.js';
import { Auth, CurrentUser } from './security.decorators.js';
import { UserEntity } from './user.entity.js';

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: DemoUsersService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with a seeded demo account' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid login DTO' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() input: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(input.email, input.password);
  }

  @Get('me')
  @Auth()
  @ApiOkResponse({ type: UserEntity })
  me(@CurrentUser() user: UserEntity): UserEntity {
    return user;
  }

  @Get('users')
  @Auth(Role.Admin)
  @ApiOkResponse({ type: UserEntity, isArray: true })
  listUsers(): UserEntity[] {
    return this.users.findAll();
  }
}
