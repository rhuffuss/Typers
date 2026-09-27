import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { AuthorsResolver, ArticlesResolver } from './editorial.resolver.js';
import { EditorialService } from './editorial.service.js';
import { EditorialPlugin } from './editorial.plugin.js';
import {
  applyUpperDirective,
  GraphqlEditorGuard,
  GraphqlNotFoundFilter,
  GraphqlTrace,
  GraphqlTraceInterceptor,
  SlugScalar,
  upperDirective,
} from './graphql.support.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: '/graphql',
      autoSchemaFile: true,
      sortSchema: true,
      fieldResolverEnhancers: ['interceptors'],
      graphiql: true,
      subscriptions: { 'graphql-ws': true },
      buildSchemaOptions: { directives: [upperDirective] },
      transformSchema: applyUpperDirective,
      context: ({
        req,
      }: {
        req?: { headers: Record<string, string | string[] | undefined> };
      }) => ({ req, role: req?.headers['x-editorial-role'] ?? 'reader' }),
    }),
  ],
  providers: [
    AuthorsResolver,
    ArticlesResolver,
    EditorialService,
    EditorialPlugin,
    SlugScalar,
    GraphqlEditorGuard,
    GraphqlNotFoundFilter,
    GraphqlTrace,
    GraphqlTraceInterceptor,
  ],
  exports: [EditorialService, GraphqlTrace],
})
export class GraphqlLabModule {}
