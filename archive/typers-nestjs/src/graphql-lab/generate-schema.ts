import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  GraphQLDefinitionsFactory,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { pathToFileURL } from 'node:url';
import { ArticlesResolver, AuthorsResolver } from './editorial.resolver.js';
import { SlugScalar, upperDirective } from './graphql.support.js';

export async function generateEditorialDefinitions(
  schemaPath: string,
  typesPath: string,
): Promise<void> {
  await new GraphQLDefinitionsFactory().generate({
    typePaths: [schemaPath],
    path: typesPath,
    outputAs: 'interface',
    emitTypenameField: true,
    debug: false,
  });
}

export async function generateEditorialSchema(): Promise<string> {
  const app = await NestFactory.createApplicationContext(
    GraphQLSchemaBuilderModule,
    { logger: false },
  );
  try {
    const schema = await app
      .get(GraphQLSchemaFactory)
      .create([AuthorsResolver, ArticlesResolver], [SlugScalar], {
        directives: [upperDirective],
      });
    return printSchema(schema);
  } finally {
    await app.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.stdout.write((await generateEditorialSchema()) + '\n');
}
