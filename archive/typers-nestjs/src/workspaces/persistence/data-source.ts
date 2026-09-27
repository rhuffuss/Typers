import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database-options.js';

// The TypeORM CLI imports this file after `pnpm build`.
export default new DataSource(databaseOptions());
