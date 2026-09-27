import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PasswordService } from './password.service.js';
import { Role } from './role.enum.js';
import { UserEntity } from './user.entity.js';

type IdentityKey = 'ADMIN' | 'READER' | 'MEMBER' | 'APPROVER' | 'FINANCE';
type IdentityVariable = `DEMO_${IdentityKey}_${'EMAIL' | 'PASSWORD'}`;
interface DemoIdentity {
  readonly key: IdentityKey;
  readonly suffix: string;
  readonly name: string;
  readonly roles: readonly Role[];
  readonly requiredInProduction: boolean;
}
const identities = [
  {
    key: 'ADMIN',
    suffix: '001',
    name: 'Demo administrator',
    roles: [Role.Admin, Role.Member],
    requiredInProduction: true,
  },
  {
    key: 'READER',
    suffix: '002',
    name: 'Demo reader',
    roles: [Role.Reader],
    requiredInProduction: true,
  },
  {
    key: 'MEMBER',
    suffix: '003',
    name: 'Demo requester',
    roles: [Role.Member],
    requiredInProduction: false,
  },
  {
    key: 'APPROVER',
    suffix: '004',
    name: 'Demo approver',
    roles: [Role.Approver],
    requiredInProduction: false,
  },
  {
    key: 'FINANCE',
    suffix: '005',
    name: 'Demo finance',
    roles: [Role.Finance, Role.Approver],
    requiredInProduction: false,
  },
] as const satisfies readonly DemoIdentity[];

const environmentValue = (key: IdentityVariable): string | undefined =>
  process.env[key];

@Injectable()
export class DemoUsersService implements OnModuleInit {
  private users: UserEntity[] = [];
  constructor(private readonly passwords: PasswordService) {}

  async onModuleInit(): Promise<void> {
    const production = process.env.NODE_ENV === 'production';
    const enabled = identities.filter(
      (identity) =>
        !production ||
        identity.requiredInProduction ||
        environmentValue(`DEMO_${identity.key}_PASSWORD`),
    );
    const missing = enabled.filter(
      (identity) => !environmentValue(`DEMO_${identity.key}_PASSWORD`),
    );
    if (production && missing.length) {
      throw new Error(
        `Set ${missing.map((identity) => `DEMO_${identity.key}_PASSWORD`).join(' and ')} in production.`,
      );
    }
    this.users = await Promise.all(
      enabled.map(async (identity) => {
        const title = `${identity.key[0]}${identity.key.slice(1).toLowerCase()}`;
        const passwordHash = await this.passwords.hash(
          environmentValue(`DEMO_${identity.key}_PASSWORD`) ??
            `TypersDemo-${title}-2026!`,
        );
        return new UserEntity({
          id: `00000000-0000-4000-8000-000000000${identity.suffix}`,
          email:
            environmentValue(`DEMO_${identity.key}_EMAIL`) ??
            `${identity.key.toLowerCase()}@typers.local`,
          name: identity.name,
          roles: [...identity.roles],
          passwordHash,
        });
      }),
    );
  }

  findByEmail(email: string): UserEntity | undefined {
    return this.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }
  findById(id: string): UserEntity | undefined {
    return this.users.find((user) => user.id === id);
  }
  findAll(): UserEntity[] {
    return this.users;
  }
}
