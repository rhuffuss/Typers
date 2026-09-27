import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  DemoAccess,
  DemoContextGuard,
  DemoContextInterceptor,
} from './demo-context.js';
import { FundamentalsService } from './fundamentals.service.js';
import { RequestProbe } from './scope-probes.js';

@Controller('fundamentals')
@DemoAccess('public')
@UseGuards(DemoContextGuard)
@UseInterceptors(DemoContextInterceptor)
export class FundamentalsController {
  constructor(private readonly fundamentals: FundamentalsService) {}

  @Get()
  summary() {
    return this.fundamentals.summary();
  }

  @Get('lazy')
  lazy() {
    return this.fundamentals.lazy();
  }

  @Get('discovery')
  discovery() {
    return this.fundamentals.discovery();
  }

  @Get('context')
  @DemoAccess('acknowledged')
  context() {
    return { message: 'Method metadata overrides the controller default.' };
  }
}

// Request scope propagates to this controller only, leaving other endpoints
// and the application service as singletons.
@Controller('fundamentals')
@DemoAccess('public')
@UseGuards(DemoContextGuard)
@UseInterceptors(DemoContextInterceptor)
export class FundamentalsScopesController {
  constructor(
    private readonly fundamentals: FundamentalsService,
    private readonly requestProbe: RequestProbe,
  ) {}

  @Get('scopes')
  scopes() {
    return this.fundamentals.scopes(this.requestProbe);
  }
}
