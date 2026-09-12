import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import { emptyRequestContext } from './request-context';
import type { RequestContext } from './request-context';

/**
 * AsyncLocalStorage wrapper for the request context. Also the primitive for
 * background jobs (spec §73–74): a worker establishes tenant scope with
 * `ctx.run({ organizationId, userId }, () => ...)` — no HTTP involved.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(seed: Partial<RequestContext>, fn: () => T): T {
    return this.storage.run(emptyRequestContext(seed), fn);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  getOrThrow(): RequestContext {
    const store = this.storage.getStore();
    if (!store) {
      // an explicit failure beats a silently-empty RLS result set
      throw new Error('No request context — call sites must run inside RequestContextService.run');
    }
    return store;
  }

  /** Enriches the active store in place (guards run after the middleware's run()). */
  patch(partial: Partial<RequestContext>): void {
    Object.assign(this.getOrThrow(), partial);
  }
}
