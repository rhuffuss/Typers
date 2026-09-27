import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DemoUsersService } from './demo-users.service.js';
import {
  JwtSettingsModule,
  JwtSettingsService,
} from './jwt-settings.module.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PasswordService } from './password.service.js';
import { JwtAuthGuard, RolesGuard } from './security.guards.js';

@Module({
  imports: [
    JwtSettingsModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.registerAsync({
      imports: [JwtSettingsModule],
      inject: [JwtSettingsService],
      useFactory: (settings: JwtSettingsService) => ({
        secret: settings.secret,
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: 900,
          issuer: settings.issuer,
          audience: settings.audience,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DemoUsersService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    DemoUsersService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
    PassportModule,
  ],
})
export class SecurityModule {}
