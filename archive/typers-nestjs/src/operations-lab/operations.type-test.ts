import { ConfigService } from '@nestjs/config';
import type { ReservationPolicy } from './operations.config.js';

export function configInference(
  config: ConfigService<{ operations: ReservationPolicy }, true>,
): void {
  const capacity: number = config.get('operations.capacity', { infer: true });
  // @ts-expect-error Inferred numeric configuration cannot be used as a string.
  const wrong: string = config.get('operations.capacity', { infer: true });
  // @ts-expect-error Paths are checked against the declared configuration shape.
  config.get('operations.missing', { infer: true });
  void capacity;
  void wrong;
}
