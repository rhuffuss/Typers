import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InMemoryWorkspacesRepository,
  WORKSPACES_REPOSITORY,
} from '../workspaces.repository.js';
import { databaseOptions } from './database-options.js';
import { TypeOrmWorkspacesRepository } from './typeorm-workspaces.repository.js';
import { ProjectRecordEntity, TaskRecordEntity } from './workspaces.entity.js';

export interface WorkspacesPersistenceOptions {
  driver: 'memory' | 'postgres';
  url?: string;
  schema?: string;
}

@Module({})
export class WorkspacesPersistenceModule {
  static register(options: WorkspacesPersistenceOptions): DynamicModule {
    if (options.driver === 'memory') {
      return {
        module: WorkspacesPersistenceModule,
        providers: [
          {
            provide: WORKSPACES_REPOSITORY,
            useClass: InMemoryWorkspacesRepository,
          },
        ],
        exports: [WORKSPACES_REPOSITORY],
      };
    }
    return {
      module: WorkspacesPersistenceModule,
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            ...databaseOptions(options.url, options.schema),
            retryAttempts: 1,
          }),
        }),
        TypeOrmModule.forFeature([ProjectRecordEntity, TaskRecordEntity]),
      ],
      providers: [
        TypeOrmWorkspacesRepository,
        {
          provide: WORKSPACES_REPOSITORY,
          useExisting: TypeOrmWorkspacesRepository,
        },
      ],
      exports: [WORKSPACES_REPOSITORY],
    };
  }
}
