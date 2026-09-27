import { DiscoveryService } from '@nestjs/core';

export const DemoFeature = DiscoveryService.createDecorator<string>();
