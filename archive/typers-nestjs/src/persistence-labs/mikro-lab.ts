import { Inject, Injectable, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { Collection, serialize } from '@mikro-orm/core';
import {
  Entity,
  EnsureRequestContext,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  ReflectMetadataProvider,
} from '@mikro-orm/decorators/legacy';
import {
  EntityRepository,
  MikroORM,
  PostgreSqlDriver,
} from '@mikro-orm/postgresql';
import { InjectRepository, MikroOrmModule } from '@mikro-orm/nestjs';
import { assertLabNamespace } from './lab-options.js';
import type { SqlLabOptions } from './lab-options.js';

@Entity({ tableName: 'mikro_writers' })
export class MikroLabWriter {
  @PrimaryKey({ type: 'number' }) id!: number;
  @Property({ type: 'string' }) name!: string;
  @Property({ type: 'string', hidden: true }) secret = 'internal-only';
  @OneToMany(() => MikroLabNote, (note) => note.writer) notes =
    new Collection<MikroLabNote>(this);
}

@Entity({ tableName: 'mikro_notes' })
export class MikroLabNote {
  @PrimaryKey({ type: 'number' }) id!: number;
  @Property({ type: 'string' }) title!: string;
  @ManyToOne(() => MikroLabWriter) writer!: MikroLabWriter;
}

@Injectable()
export class MikroLabService {
  constructor(
    @Inject(MikroORM) readonly orm: MikroORM,
    @InjectRepository(MikroLabWriter)
    readonly writers: EntityRepository<MikroLabWriter>,
  ) {}
  @EnsureRequestContext()
  async create(name: string, title: string) {
    const writer = this.orm.em.create(MikroLabWriter, {
      name,
      notes: [],
      secret: 'internal-only',
    });
    const note = this.orm.em.create(MikroLabNote, { title, writer });
    writer.notes.add(note);
    this.orm.em.persist(writer);
    await this.orm.em.flush();
    return writer.id;
  }
  @EnsureRequestContext()
  async find(id: number) {
    const writer = await this.writers.findOneOrFail(id, {
      populate: ['notes'],
    });
    return serialize(writer, { populate: ['notes'] });
  }
  @EnsureRequestContext()
  async count() {
    return this.writers.count();
  }
  @EnsureRequestContext()
  async contextId() {
    await Promise.resolve();
    return this.orm.em.getContext().id;
  }
  @EnsureRequestContext()
  async rollbackProbe() {
    await this.orm.em.transactional(async (em) => {
      const writer = em.create(MikroLabWriter, {
        name: 'Rolled back writer',
        notes: [],
        secret: 'internal-only',
      });
      em.persist(writer);
      await em.flush();
      throw new Error('mikro-rollback-probe');
    });
  }
}

@Module({})
export class MikroLabModule {
  static register(options: SqlLabOptions): DynamicModule {
    const schema = assertLabNamespace(options.schema);
    return {
      module: MikroLabModule,
      imports: [
        MikroOrmModule.forRoot({
          driver: PostgreSqlDriver,
          clientUrl: options.url,
          schema,
          entities: [MikroLabWriter, MikroLabNote],
          metadataProvider: ReflectMetadataProvider,
          registerRequestContext: false,
          allowGlobalContext: false,
          debug: false,
        }),
        MikroOrmModule.forFeature([MikroLabWriter, MikroLabNote]),
      ],
      providers: [MikroLabService],
      exports: [MikroLabService],
    };
  }
}
