import { Injectable, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import {
  InjectConnection,
  InjectModel,
  MongooseModule,
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import type { Connection, HydratedDocument, Model } from 'mongoose';
import { assertLabNamespace } from './lab-options.js';
import type { MongoLabOptions } from './lab-options.js';

@Schema({ _id: false })
export class MongoLabMetadata {
  @Prop({ type: String, required: true }) category: string;
}
const metadataSchema = SchemaFactory.createForClass(MongoLabMetadata);

@Schema({ collection: 'lab_notes', timestamps: true, discriminatorKey: 'kind' })
export class MongoLabNote {
  @Prop({ type: String, required: true, unique: true }) slug: string;
  @Prop({ type: String, required: true, minlength: 3 }) title: string;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: metadataSchema, required: true }) metadata: MongoLabMetadata;
  @Prop({ type: Boolean, default: false }) prepared: boolean;
  createdAt: Date;
}
export type MongoLabNoteDocument = HydratedDocument<MongoLabNote>;

@Schema()
export class MongoLabPublishedNote {
  @Prop({ type: String, required: true }) publication: string;
}

@Injectable()
export class MongooseLabService {
  constructor(
    @InjectModel(MongoLabNote.name, 'mongoose-lab')
    readonly notes: Model<MongoLabNote>,
    @InjectModel(MongoLabPublishedNote.name, 'mongoose-lab')
    readonly published: Model<MongoLabNote & MongoLabPublishedNote>,
    @InjectConnection('mongoose-lab') readonly connection: Connection,
  ) {}
  create(slug: string, title: string) {
    return this.notes.create({
      slug,
      title,
      tags: ['nestjs'],
      metadata: { category: 'compiler' },
    });
  }
  find(slug: string) {
    return this.notes.findOne({ slug }).lean().exec();
  }
}

@Module({})
export class MongooseLabModule {
  static register(options: MongoLabOptions): DynamicModule {
    assertLabNamespace(options.database);
    return {
      module: MongooseLabModule,
      imports: [
        MongooseModule.forRoot(options.url, {
          dbName: options.database,
          connectionName: 'mongoose-lab',
          retryAttempts: 0,
          serverSelectionTimeoutMS: 5000,
        }),
        MongooseModule.forFeatureAsync(
          [
            {
              name: MongoLabNote.name,
              useFactory: () => {
                const schema = SchemaFactory.createForClass(MongoLabNote);
                schema.pre('save', function () {
                  this.prepared = true;
                  this.title = this.title.trim();
                });
                return schema;
              },
              discriminators: [
                {
                  name: MongoLabPublishedNote.name,
                  schema: SchemaFactory.createForClass(MongoLabPublishedNote),
                },
              ],
            },
          ],
          'mongoose-lab',
        ),
      ],
      providers: [MongooseLabService],
      exports: [MongooseLabService],
    };
  }
}
