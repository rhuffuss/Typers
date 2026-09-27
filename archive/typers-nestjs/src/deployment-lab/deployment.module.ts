import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Req,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export class DeploymentEchoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  message: string;
}

@Injectable()
export class DeploymentState {
  readonly instanceId = randomUUID();
  private invocations = 0;
  next() {
    return { instanceId: this.instanceId, invocation: ++this.invocations };
  }
}

@Controller('deployment')
export class DeploymentController {
  constructor(private readonly state: DeploymentState) {}

  @Get('status')
  status() {
    return this.state.next();
  }

  @Post('echo')
  echo(@Body() body: DeploymentEchoDto) {
    return { message: body.message };
  }

  @Get('connection')
  connection(@Req() request: Request) {
    return {
      ...this.state.next(),
      remotePort: request.socket.remotePort,
      encrypted: request.protocol === 'https',
    };
  }
}

@Module({ controllers: [DeploymentController], providers: [DeploymentState] })
export class DeploymentLabModule {}
