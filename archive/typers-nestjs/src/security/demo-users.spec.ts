import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoUsersService } from './demo-users.service.js';
import { PasswordService } from './password.service.js';

describe('Business demo identities', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('provides distinct requester, reviewer and finance identities for local workflows', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const passwords = new PasswordService();
    const users = new DemoUsersService(passwords);
    await users.onModuleInit();
    expect(users.findAll()).toHaveLength(5);
    expect(new Set(users.findAll().map((user) => user.id)).size).toBe(5);
    expect(users.findByEmail('member@typers.local')?.roles).toEqual(['member']);
    expect(users.findByEmail('approver@typers.local')?.roles).toEqual([
      'approver',
    ]);
    expect(users.findByEmail('finance@typers.local')?.roles).toEqual([
      'finance',
      'approver',
    ]);
    expect(
      await passwords.verify(
        'TypersDemo-Member-2026!',
        users.findByEmail('member@typers.local')!.passwordHash,
      ),
    ).toBe(true);
  });

  it('enables additional production identities only with explicit passwords', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_ADMIN_PASSWORD', 'production-admin-test-password');
    vi.stubEnv('DEMO_READER_PASSWORD', 'production-reader-test-password');
    for (const key of ['MEMBER', 'APPROVER', 'FINANCE'])
      vi.stubEnv(`DEMO_${key}_PASSWORD`, undefined);
    const users = new DemoUsersService(new PasswordService());
    await users.onModuleInit();
    expect(users.findAll()).toHaveLength(2);
    expect(users.findByEmail('member@typers.local')).toBeUndefined();
    vi.stubEnv('DEMO_FINANCE_PASSWORD', 'production-finance-test-password');
    await users.onModuleInit();
    expect(users.findAll()).toHaveLength(3);
    expect(users.findByEmail('finance@typers.local')?.roles).toContain(
      'finance',
    );
  });
});
