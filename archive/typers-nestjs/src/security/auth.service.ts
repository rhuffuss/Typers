import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DemoUsersService } from './demo-users.service.js';
import { PasswordService } from './password.service.js';
import { LoginResponseDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: DemoUsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = this.users.findByEmail(email);
    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      user,
    };
  }
}
