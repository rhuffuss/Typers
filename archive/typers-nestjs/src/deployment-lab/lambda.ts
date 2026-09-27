import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import type { RequestListener } from 'node:http';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Handler,
} from 'aws-lambda';
import { DeploymentLabModule } from './deployment.module.js';

type GatewayHandler = Handler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>;

export function createLambdaHandler() {
  type Runtime = { app: NestExpressApplication; bridge: GatewayHandler };
  let pending: Promise<Runtime> | undefined;

  const bootstrap = async (): Promise<Runtime> => {
    const adapter = new ExpressAdapter();
    const app = await NestFactory.create<NestExpressApplication>(
      DeploymentLabModule,
      adapter,
      { logger: false, abortOnError: false },
    );
    try {
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();
      return {
        app,
        bridge: serverlessExpress<
          APIGatewayProxyEventV2,
          APIGatewayProxyStructuredResultV2
        >({
          app: adapter.getInstance() as RequestListener,
          respondWithErrors: false,
        }),
      };
    } catch (error) {
      await app.close();
      throw error;
    }
  };

  const handler: GatewayHandler = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    // Share the initialization promise, including simultaneous cold invocations.
    pending ??= bootstrap().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    const runtime = await pending;
    const result = await runtime.bridge(event, context, callback);
    return result as APIGatewayProxyStructuredResultV2;
  };

  const close = async () => {
    const runtime = pending;
    pending = undefined;
    if (runtime) await (await runtime).app.close();
  };
  return { handler, close };
}

// AWS entrypoint: deployment-lab/lambda.handler. No server listens on a port.
const lambda = createLambdaHandler();
export const handler = lambda.handler;
export const closeLambda = lambda.close;
