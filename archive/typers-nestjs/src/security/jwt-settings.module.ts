import { Injectable, Module } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

@Injectable()
export class JwtSettingsService {
  readonly secret: string;
  readonly issuer = 'typers-nestjs';
  readonly audience = 'typers-laboratory';

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('JWT_SECRET is required in production.');
    }
    if (secret && secret.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters.');
    }
    // Local tokens intentionally expire when this application instance restarts.
    this.secret = secret ?? randomBytes(48).toString('base64url');
  }
}

@Module({ providers: [JwtSettingsService], exports: [JwtSettingsService] })
export class JwtSettingsModule {}
