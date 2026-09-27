import { Injectable, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import {
  InjectConnection,
  InjectModel,
  SequelizeModule,
} from '@nestjs/sequelize';
import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import type { Sequelize } from 'sequelize-typescript';
import type { Optional } from 'sequelize';
import { assertLabNamespace } from './lab-options.js';
import type { SqlLabOptions } from './lab-options.js';

interface WriterAttributes {
  id: number;
  name: string;
}
interface NoteAttributes {
  id: number;
  title: string;
  writerId: number;
}

@Table({ tableName: 'sequelize_writers', timestamps: false })
export class SequelizeLabWriter extends Model<
  WriterAttributes,
  Optional<WriterAttributes, 'id'>
> {
  @PrimaryKey @AutoIncrement @Column(DataType.INTEGER) declare id: number;
  @AllowNull(false) @Column(DataType.STRING) declare name: string;
  @HasMany(() => SequelizeLabNote) declare notes: SequelizeLabNote[];
}

@Table({ tableName: 'sequelize_notes', timestamps: false })
export class SequelizeLabNote extends Model<
  NoteAttributes,
  Optional<NoteAttributes, 'id'>
> {
  @PrimaryKey @AutoIncrement @Column(DataType.INTEGER) declare id: number;
  @AllowNull(false) @Column(DataType.STRING) declare title: string;
  @ForeignKey(() => SequelizeLabWriter)
  @Column(DataType.INTEGER)
  declare writerId: number;
  @BelongsTo(() => SequelizeLabWriter) declare writer: SequelizeLabWriter;
}

@Injectable()
export class SequelizeLabService {
  constructor(
    @InjectModel(SequelizeLabWriter, 'sequelize-lab')
    readonly writers: typeof SequelizeLabWriter,
    @InjectModel(SequelizeLabNote, 'sequelize-lab')
    readonly notes: typeof SequelizeLabNote,
    @InjectConnection('sequelize-lab') readonly sequelize: Sequelize,
  ) {}
  async create(name: string, title: string) {
    return this.sequelize.transaction(async (transaction) => {
      const writer = await this.writers.create({ name }, { transaction });
      await this.notes.create({ writerId: writer.id, title }, { transaction });
      return writer.id;
    });
  }
  find(id: number) {
    return this.writers.findByPk(id, { include: [SequelizeLabNote] });
  }
  async rollbackProbe() {
    await this.sequelize.transaction(async (transaction) => {
      const writer = await this.writers.create(
        { name: 'Rolled back writer' },
        { transaction },
      );
      await this.notes.create(
        { writerId: writer.id, title: 'Rolled back note' },
        { transaction },
      );
      throw new Error('sequelize-rollback-probe');
    });
  }
}

@Module({})
export class SequelizeLabModule {
  static register(options: SqlLabOptions): DynamicModule {
    const schema = assertLabNamespace(options.schema);
    const url = new URL(options.url);
    return {
      module: SequelizeLabModule,
      imports: [
        SequelizeModule.forRoot({
          name: 'sequelize-lab',
          dialect: 'postgres',
          host: url.hostname,
          port: Number(url.port || 5432),
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database: url.pathname.slice(1),
          define: { schema },
          autoLoadModels: true,
          synchronize: true,
          logging: false,
          retryAttempts: 0,
        }),
        SequelizeModule.forFeature(
          [SequelizeLabWriter, SequelizeLabNote],
          'sequelize-lab',
        ),
      ],
      providers: [SequelizeLabService],
      exports: [SequelizeLabService],
    };
  }
}
