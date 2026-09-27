import { Controller, Get, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('rate-limit')
@UseGuards(ThrottlerGuard)
export class RateLimitController {
  @Get()
  limited() {
    return { allowed: true };
  }
}
