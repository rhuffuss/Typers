import { Injectable } from '@nestjs/common';
import type {
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

@Injectable()
export class LifecycleProbeService
  implements
    OnModuleInit,
    OnApplicationBootstrap,
    OnModuleDestroy,
    BeforeApplicationShutdown,
    OnApplicationShutdown
{
  private readonly events: string[] = [];

  onModuleInit(): void {
    this.events.push('onModuleInit');
  }

  onApplicationBootstrap(): void {
    this.events.push('onApplicationBootstrap');
  }

  onModuleDestroy(): void {
    this.events.push('onModuleDestroy');
  }

  beforeApplicationShutdown(): void {
    this.events.push('beforeApplicationShutdown');
  }

  onApplicationShutdown(): void {
    this.events.push('onApplicationShutdown');
  }

  snapshot(): readonly string[] {
    return [...this.events];
  }
}
