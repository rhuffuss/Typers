import { Inject, Injectable, Module } from '@nestjs/common';
import type {
  DynamicModule,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import { assertLabNamespace, SQL_LAB_OPTIONS } from '../lab-options.js';
import type { SqlLabOptions } from '../lab-options.js';

@Injectable()
export class PrismaLabService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  connected = false;
  constructor(@Inject(SQL_LAB_OPTIONS) options: SqlLabOptions) {
    super({
      adapter: new PrismaPg(
        { connectionString: options.url },
        { schema: assertLabNamespace(options.schema) },
      ),
    });
  }
  async onModuleInit() {
    await this.$connect();
    this.connected = true;
  }
  async onModuleDestroy() {
    await this.$disconnect();
    this.connected = false;
  }
  create(name: string, title: string) {
    return this.prismaLabWriter.create({
      data: { name, notes: { create: { title } } },
      include: { notes: true },
    });
  }
  find(id: number) {
    return this.prismaLabWriter.findUniqueOrThrow({
      where: { id },
      include: { notes: true },
    });
  }
  async rollbackProbe() {
    await this.$transaction(async (transaction) => {
      await transaction.prismaLabWriter.create({
        data: {
          name: 'Rolled back writer',
          notes: { create: { title: 'Rolled back note' } },
        },
      });
      throw new Error('prisma-rollback-probe');
    });
  }
}

@Module({})
export class PrismaLabModule {
  static register(options: SqlLabOptions): DynamicModule {
    assertLabNamespace(options.schema);
    return {
      module: PrismaLabModule,
      providers: [
        { provide: SQL_LAB_OPTIONS, useValue: options },
        PrismaLabService,
      ],
      exports: [PrismaLabService],
    };
  }
}
