import { Inject, Injectable } from '@nestjs/common';
import {
  ContextIdFactory,
  DiscoveryService,
  LazyModuleLoader,
  ModuleRef,
} from '@nestjs/core';
import { CircularDemoService } from './circular-demo.module.js';
import { DemoFeature } from './demo-feature.decorator.js';
import { DemoSettingsService } from './demo-settings.module.js';
import {
  ASYNC_CATALOG,
  DEMO_NAME,
  GREETING,
  GREETING_ALIAS,
} from './fundamentals.tokens.js';
import type { Greeting, PreparedCatalog } from './fundamentals.tokens.js';
import { LifecycleProbeService } from './lifecycle-probe.service.js';
import {
  AdHocProbe,
  FirstConsumer,
  RequestProbe,
  SecondConsumer,
  SingletonProbe,
  TransientProbe,
} from './scope-probes.js';

@Injectable()
export class FundamentalsService {
  constructor(
    @Inject(DEMO_NAME) private readonly demoName: string,
    @Inject(GREETING) private readonly greeting: Greeting,
    @Inject(GREETING_ALIAS) private readonly greetingAlias: Greeting,
    @Inject(ASYNC_CATALOG) private readonly catalog: PreparedCatalog,
    private readonly settings: DemoSettingsService,
    private readonly moduleRef: ModuleRef,
    private readonly loader: LazyModuleLoader,
    private readonly discoveryService: DiscoveryService,
    private readonly lifecycle: LifecycleProbeService,
    private readonly circular: CircularDemoService,
    private readonly firstConsumer: FirstConsumer,
    private readonly secondConsumer: SecondConsumer,
  ) {}

  summary() {
    return {
      name: this.demoName,
      greeting: this.greeting.greet(this.demoName),
      aliasIsSameInstance: this.greeting === this.greetingAlias,
      catalog: this.catalog,
      settings: this.settings.options,
      lifecycle: this.lifecycle.snapshot(),
      circular: this.circular.inspect(),
    };
  }

  async scopes(current: RequestProbe) {
    const requestContext = ContextIdFactory.getByRequest(current.request);
    const currentAgain = await this.moduleRef.resolve(
      RequestProbe,
      requestContext,
    );
    const manualContext = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId(
      { headers: { 'x-demo-source': 'manual-context' } },
      manualContext,
    );
    const [
      manual,
      manualAgain,
      transient,
      transientAgain,
      shared,
      sharedAgain,
    ] = await Promise.all([
      this.moduleRef.resolve(RequestProbe, manualContext),
      this.moduleRef.resolve(RequestProbe, manualContext),
      this.moduleRef.resolve(TransientProbe),
      this.moduleRef.resolve(TransientProbe),
      this.moduleRef.resolve(TransientProbe, manualContext),
      this.moduleRef.resolve(TransientProbe, manualContext),
    ]);
    const singleton = this.moduleRef.get(SingletonProbe);
    const adHoc = await this.moduleRef.create(AdHocProbe);

    return {
      singleton: {
        id: singleton.id,
        sameViaGet: singleton === this.moduleRef.get(SingletonProbe),
        sameInCreatedClass: adHoc.singleton === singleton,
      },
      request: {
        id: current.id,
        sameWithinRequest: current === currentAgain,
        manualId: manual.id,
        sameWithinManualContext: manual === manualAgain,
        differentContexts: current !== manual,
        registeredRequestSource: manual.request.headers['x-demo-source'],
      },
      transient: {
        firstConsumerId: this.firstConsumer.transient.id,
        secondConsumerId: this.secondConsumer.transient.id,
        differentConsumers:
          this.firstConsumer.transient !== this.secondConsumer.transient,
        differentImplicitContexts: transient !== transientAgain,
        sameExplicitContext: shared === sharedAgain,
      },
    };
  }

  async lazy() {
    const { LazyReportModule, LazyReportService } =
      await import('./lazy-report.module.js');
    const moduleRef = await this.loader.load(() => LazyReportModule);
    const service = moduleRef.get(LazyReportService, { strict: true });
    return service.report();
  }

  discovery() {
    const providers = this.discoveryService
      .getProviders()
      .flatMap((wrapper) => {
        const feature = this.discoveryService.getMetadataByDecorator(
          DemoFeature,
          wrapper,
        );
        return feature ? [{ feature, provider: wrapper.name }] : [];
      })
      .sort((left, right) => left.feature.localeCompare(right.feature));
    const controllers = this.discoveryService
      .getControllers()
      .map((wrapper) => wrapper.name)
      .filter((name) => name.startsWith('Fundamentals'))
      .sort((left, right) => left.localeCompare(right));
    return { providers, controllers };
  }
}
