import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordService } from './password.service.js';
import { JwtSettingsService } from './jwt-settings.module.js';

describe('Security primitives', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses a fresh salt and verifies the password', async () => {
    const service = new PasswordService();
    const [first, second] = await Promise.all([
      service.hash('demo-password'),
      service.hash('demo-password'),
    ]);
    expect(first).not.toEqual(second);
    expect(await service.verify('demo-password', first)).toBe(true);
    expect(await service.verify('incorrect', first)).toBe(false);
    expect(await service.verify('demo-password', 'invalid')).toBe(false);
  });

  it('generates instance-local secrets and requires a configured secret in production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_SECRET', undefined);
    expect(new JwtSettingsService().secret).not.toEqual(
      new JwtSettingsService().secret,
    );
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => new JwtSettingsService()).toThrow('JWT_SECRET is required');
    vi.stubEnv('JWT_SECRET', 'short');
    expect(() => new JwtSettingsService()).toThrow('at least 32');
    vi.stubEnv('JWT_SECRET', 'a-secret-with-more-than-thirty-two-characters');
    expect(new JwtSettingsService().secret).toBe(
      'a-secret-with-more-than-thirty-two-characters',
    );
  });
});
