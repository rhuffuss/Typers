import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContextIdFactory } from '@nestjs/core';
import type {
  ContextId,
  ContextIdStrategy,
  HostComponentInfo,
} from '@nestjs/core';
import type { Request } from 'express';

export const TENANT_PAYLOAD = Symbol('TENANT_PAYLOAD');
export const ALLOWED_TENANTS = ['acme', 'globex', 'initech'] as const;
export type TenantId = (typeof ALLOWED_TENANTS)[number];
export interface TenantPayload {
  readonly tenantId: TenantId;
}

export function allowedTenant(value: unknown): TenantId {
  if (value === 'acme' || value === 'globex' || value === 'initech')
    return value;
  throw new ForbiddenException('An allowed x-tenant-id is required');
}

/** Bounded LRU of context identities; no request or user data is retained. */
export class AllowedTenantContextStrategy implements ContextIdStrategy<Request> {
  readonly #contexts = new Map<TenantId, ContextId>();

  constructor(readonly capacity = 2) {
    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > ALLOWED_TENANTS.length
    ) {
      throw new BadRequestException(
        'Context capacity must be between 1 and the number of allowed tenants',
      );
    }
  }

  attach(contextId: ContextId, request: Request) {
    const tenantId = allowedTenant(request.headers['x-tenant-id']);
    let tenantContext = this.#contexts.get(tenantId);
    if (tenantContext) this.#contexts.delete(tenantId);
    else tenantContext = ContextIdFactory.create();
    this.#contexts.set(tenantId, tenantContext);
    if (this.#contexts.size > this.capacity) {
      const oldest = this.#contexts.keys().next();
      if (!oldest.done) this.#contexts.delete(oldest.value);
    }
    return {
      resolve: (info: HostComponentInfo) =>
        info.isTreeDurable ? tenantContext : contextId,
      payload: Object.freeze({ tenantId }),
    };
  }

  get cachedTenants(): readonly TenantId[] {
    return [...this.#contexts.keys()];
  }
  clear(): void {
    this.#contexts.clear();
  }
}

/** Public-API reset to ordinary per-request contexts after this isolated lab. */
export class IndependentRequestContextStrategy implements ContextIdStrategy {
  attach(): undefined {
    return undefined;
  }
}
