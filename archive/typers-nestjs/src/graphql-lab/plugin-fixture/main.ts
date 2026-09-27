import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { PluginAuthorResolver } from './plugin-author.resolver.js';

const app = await NestFactory.createApplicationContext(
  GraphQLSchemaBuilderModule,
  { logger: false },
);
try {
  const schema = await app
    .get(GraphQLSchemaFactory)
    .create([PluginAuthorResolver]);
  process.stdout.write(printSchema(schema) + '\n');
} finally {
  await app.close();
}
