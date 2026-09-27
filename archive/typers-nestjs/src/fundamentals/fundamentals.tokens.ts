export const DEMO_NAME = Symbol('fundamentals.demo-name');
export const GREETING = Symbol('fundamentals.greeting');
export const GREETING_ALIAS = Symbol('fundamentals.greeting-alias');
export const ASYNC_CATALOG = Symbol('fundamentals.async-catalog');

export interface Greeting {
  greet(name: string): string;
}

export interface PreparedCatalog {
  readonly ready: true;
  readonly name: string;
  readonly entries: readonly string[];
}

export interface DemoRequest {
  readonly headers: Record<string, string | string[] | undefined>;
}
