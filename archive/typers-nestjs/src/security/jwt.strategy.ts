import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DemoUsersService } from './demo-users.service.js';
import { JwtSettingsService } from './jwt-settings.module.js';
import { UserEntity } from './user.entity.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    settings: JwtSettingsService,
    private readonly users: DemoUsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: settings.secret,
      algorithms: ['HS256'],
      issuer: settings.issuer,
      audience: settings.audience,
    });
  }

  validate(payload: { sub?: unknown }): UserEntity {
    const user =
      typeof payload.sub === 'string'
        ? this.users.findById(payload.sub)
        : undefined;
    if (!user) throw new UnauthorizedException();
    // Read current roles from the provider, never from caller-controlled claims.
    return user;
  }
}
