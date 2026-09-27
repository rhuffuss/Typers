import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  Args,
  GraphQLModule,
  Parent,
  Query,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloGatewayDriver } from '@nestjs/apollo';
import type {
  ApolloFederationDriverConfig,
  ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { IntrospectAndCompose } from '@apollo/gateway';

@Resolver('FederatedAuthor')
class FederatedAuthorsResolver {
  @Query('federatedAuthors') authors() {
    return [{ id: 'a1', name: 'Ada Lovelace' }];
  }
  @ResolveReference() resolveReference(reference: { id: string }) {
    return { id: reference.id, name: 'Ada Lovelace' };
  }
}

@Resolver('FederatedArticle')
class FederatedArticlesResolver {
  @Query('federatedArticle') article(@Args('id') id: string) {
    return { id, title: 'Federated Nest', authorId: 'a1' };
  }
  @ResolveField('author') author(@Parent() article: { authorId: string }) {
    return { __typename: 'FederatedAuthor', id: article.authorId };
  }
}

@Resolver('FederatedAuthor')
class FederatedAuthorArticlesResolver {
  @ResolveField('articles') articles(@Parent() author: { id: string }) {
    return [{ id: 'f1', title: 'Federated Nest', authorId: author.id }];
  }
}

@Module({ providers: [FederatedAuthorsResolver] })
class FederationAuthorsDomain {}
@Module({
  providers: [FederatedArticlesResolver, FederatedAuthorArticlesResolver],
})
class FederationArticlesDomain {}

@Module({
  imports: [
    FederationAuthorsDomain,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      include: [FederationAuthorsDomain],
      typeDefs: `type FederatedAuthor @key(fields: "id") { id: ID!, name: String! } type Query { federatedAuthors: [FederatedAuthor!]! }`,
    }),
  ],
})
export class FederationAuthorsModule {}

@Module({
  imports: [
    FederationArticlesDomain,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      include: [FederationArticlesDomain],
      typeDefs: `
    extend type FederatedAuthor @key(fields: "id") { id: ID! @external, articles: [FederatedArticle!]! }
    type FederatedArticle { id: ID!, title: String!, author: FederatedAuthor! }
    type Query { federatedArticle(id: ID!): FederatedArticle }
  `,
    }),
  ],
})
export class FederationArticlesModule {}

export interface FederationLab {
  authors: INestApplication;
  articles: INestApplication;
  gateway: INestApplication;
  url: string;
  close(): Promise<void>;
}

/** Three real HTTP servers; ports are assigned by the OS so tests can run together. */
export async function createFederationLab(): Promise<FederationLab> {
  const apps: INestApplication[] = [];
  try {
    const authors = await NestFactory.create(FederationAuthorsModule, {
      logger: false,
    });
    apps.push(authors);
    await authors.listen(0, '127.0.0.1');
    const articles = await NestFactory.create(FederationArticlesModule, {
      logger: false,
    });
    apps.push(articles);
    await articles.listen(0, '127.0.0.1');
    @Module({
      imports: [
        GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
          driver: ApolloGatewayDriver,
          server: {},
          gateway: {
            supergraphSdl: new IntrospectAndCompose({
              subgraphs: [
                { name: 'authors', url: `${await authors.getUrl()}/graphql` },
                { name: 'articles', url: `${await articles.getUrl()}/graphql` },
              ],
            }),
          },
        }),
      ],
    })
    class FederationGatewayModule {}
    const gateway = await NestFactory.create(FederationGatewayModule, {
      logger: false,
    });
    apps.push(gateway);
    await gateway.listen(0, '127.0.0.1');
    return {
      authors,
      articles,
      gateway,
      url: `${await gateway.getUrl()}/graphql`,
      close: async () => {
        for (const app of [...apps].reverse()) await app.close();
      },
    };
  } catch (error) {
    for (const app of [...apps].reverse()) await app.close();
    throw error;
  }
}
