import { Controller, Get, Injectable, Module } from '@nestjs/common';
import {
  GraphInspector,
  ModulesContainer,
  NestContainer,
  NestFactory,
  SerializedGraph,
} from '@nestjs/core';
import { DevtoolsModule } from '@nestjs/devtools-integration';
import type { NestExpressApplication } from '@nestjs/platform-express';

@Injectable()
export class DevtoolsGraphService {
  constructor(
    private readonly graph: SerializedGraph,
    private readonly modules: ModulesContainer,
  ) {}

  snapshot() {
    return this.graph.toJSON();
  }

  inspect() {
    // Public exported APIs: reconstruct a structural graph from the real modules.
    const container = new NestContainer();
    const inspector = new GraphInspector(container);
    inspector.inspectModules(this.modules);
    for (const module of this.modules.values()) {
      for (const wrapper of module.providers.values())
        inspector.inspectInstanceWrapper(wrapper, module);
      for (const wrapper of module.controllers.values())
        inspector.inspectInstanceWrapper(wrapper, module);
    }
    return container.serializedGraph.toJSON();
  }
}

@Controller('devtools')
export class DevtoolsController {
  constructor(private readonly graphs: DevtoolsGraphService) {}
  @Get('graph')
  graph() {
    return this.graphs.snapshot();
  }
  @Get('inspect')
  inspect() {
    return this.graphs.inspect();
  }
}

export async function createDevtoolsApp(
  options: { http?: boolean; port?: number } = {},
): Promise<NestExpressApplication> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('The Devtools laboratory is development-only');
  @Module({
    imports: [
      DevtoolsModule.register({
        http: options.http ?? false,
        port: options.port,
      }),
    ],
    controllers: [DevtoolsController],
    providers: [DevtoolsGraphService],
  })
  class DevtoolsLabModule {}
  return NestFactory.create<NestExpressApplication>(DevtoolsLabModule, {
    snapshot: true,
    logger: false,
    abortOnError: false,
  });
}
