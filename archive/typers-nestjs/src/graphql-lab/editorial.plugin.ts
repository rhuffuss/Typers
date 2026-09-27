import { Inject } from '@nestjs/common';
import { Plugin } from '@nestjs/apollo';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { GraphQLError } from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';

@Plugin()
export class EditorialPlugin implements ApolloServerPlugin {
  readonly operations: { name?: string; complexity: number }[] = [];
  completedRequests = 0;
  constructor(
    @Inject(GraphQLSchemaHost) private readonly schemaHost: GraphQLSchemaHost,
  ) {}
  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    return {
      didResolveOperation: async ({ request, document }) => {
        const complexity = getComplexity({
          schema: this.schemaHost.schema,
          query: document,
          operationName: request.operationName,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });
        this.operations.push({ name: request.operationName, complexity });
        if (complexity > 100)
          throw new GraphQLError('Query complexity exceeds 100', {
            extensions: { code: 'QUERY_TOO_COMPLEX', complexity },
          });
      },
      willSendResponse: async () => {
        this.completedRequests++;
      },
    };
  }
}
