import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  Args,
  GraphQLModule,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { MercuriusDriver } from '@nestjs/mercurius';
import type { MercuriusDriverConfig } from '@nestjs/mercurius';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { applyUpperDirective } from './graphql.support.js';
import { readFileSync } from 'node:fs';

export const editorialTypeDefs = readFileSync(
  new URL('./editorial.schema.graphql', import.meta.url),
  'utf8',
);

@Injectable()
export class SchemaEditorialStore {
  articles = [{ id: 's1', title: 'Schema driven API', authorId: 'a1' }];
}

@Resolver('SchemaAuthor')
export class SchemaAuthorsResolver {
  constructor(
    @Inject(SchemaEditorialStore) private readonly store: SchemaEditorialStore,
  ) {}
  @Query('schemaAuthor') author(@Args('id') id: string) {
    return id === 'a1' ? { id, name: 'Ada' } : null;
  }
  @ResolveField('articles') articles(@Parent() author: { id: string }) {
    return this.store.articles.filter(
      (article) => article.authorId === author.id,
    );
  }
  @Mutation('createSchemaArticle') create(
    @Args('input') input: { title: string; authorId: string },
  ) {
    const article = { ...input, id: 's' + (this.store.articles.length + 1) };
    this.store.articles.push(article);
    return article;
  }
}

@Module({
  imports: [
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      typeDefs: editorialTypeDefs,
      graphiql: true,
      transformSchema: applyUpperDirective,
    }),
  ],
  providers: [SchemaAuthorsResolver, SchemaEditorialStore],
})
export class SchemaFirstLabModule {}

export async function createSchemaFirstApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    SchemaFirstLabModule,
    new FastifyAdapter(),
    { logger: false },
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
