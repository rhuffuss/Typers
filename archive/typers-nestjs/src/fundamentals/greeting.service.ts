import { Injectable } from '@nestjs/common';
import { DemoFeature } from './demo-feature.decorator.js';
import type { Greeting } from './fundamentals.tokens.js';

@Injectable()
@DemoFeature('greeting')
export class GreetingService implements Greeting {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}
