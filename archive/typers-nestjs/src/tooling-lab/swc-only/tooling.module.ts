import { Controller, Get, Module } from '@nestjs/common';
import { BuildMessageService } from './message.service.js';

@Controller('tooling')
export class ToolingController {
  // Deliberately requires emitted design:paramtypes: no explicit @Inject token.
  constructor(private readonly messages: BuildMessageService) {}
  @Get()
  read() {
    const dependencies = Reflect.getMetadata(
      'design:paramtypes',
      ToolingController,
    ) as Function[];
    return {
      builder: 'swc',
      message: this.messages.value(),
      dependencies: dependencies.map((dependency) => dependency.name),
    };
  }
}

@Module({ controllers: [ToolingController], providers: [BuildMessageService] })
export class SwcToolingModule {}
