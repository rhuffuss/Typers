import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';
import { CreateWorkspaces1789488000000 } from './migrations/1789488000000-CreateWorkspaces.js';
import { ProjectRecordEntity, TaskRecordEntity } from './workspaces.entity.js';

export function databaseOptions(
  url = process.env.DATABASE_URL,
  schema = process.env.DATABASE_SCHEMA ?? 'public',
): PostgresConnectionOptions {
  if (!url)
    throw new Error('DATABASE_URL is required when DEMO_DATABASE=postgres');
  if (!/^[a-z_][a-z0-9_]*$/.test(schema))
    throw new Error(
      'DATABASE_SCHEMA must be a lowercase PostgreSQL identifier',
    );
  return {
    type: 'postgres',
    url,
    schema,
    entities: [ProjectRecordEntity, TaskRecordEntity],
    migrations: [CreateWorkspaces1789488000000],
    migrationsTableName: 'typers_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
