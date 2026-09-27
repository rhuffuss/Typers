import { Controller, Get } from '@nestjs/common';
import { ObservabilityService } from './observability.service.js';

@Controller('observe')
export class ObservabilityController {
  constructor(private readonly observations: ObservabilityService) {}

  @Get('work')
  work() {
    return this.observations.work();
  }

  @Get('handled-error')
  handledError() {
    return this.observations.handledError();
  }

  @Get('error')
  error() {
    return this.observations.fail();
  }

  @Get('downstream')
  downstream() {
    return this.observations.downstream();
  }

  @Get('log')
  log() {
    return this.observations.log();
  }

  @Get('health')
  health() {
    return { healthy: true };
  }
}
