import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = (await deriveKey(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${key.toString('hex')}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, salt, hex] = encoded.split(':');
    if (algorithm !== 'scrypt' || !salt || !hex) return false;
    const expected = Buffer.from(hex, 'hex');
    if (expected.length !== 64) return false;
    const actual = (await deriveKey(password, salt, 64)) as Buffer;
    return timingSafeEqual(actual, expected);
  }
}
