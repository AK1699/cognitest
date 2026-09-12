import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { RequestContextService } from '../common/context/request-context.service';
import { DRIZZLE } from './db.tokens';
import type { Database } from './db.tokens';

/**
 * Runs units of work inside a transaction with the tenant GUCs applied via
 * SET LOCAL (set_config(..., true)), so RLS policies see the caller's
 * organization. Transaction-scoped GUCs cannot leak onto pooled connections —
 * the reason this deliberately isn't a session-pinned connection.
 */
@Injectable()
export class TenantDb {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ctx: RequestContextService,
  ) {}

  /** Tenant-scoped unit of work. Throws when no organization context is set. */
  async run<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    const { organizationId, userId } = this.ctx.getOrThrow();
    if (!organizationId) {
      throw new Error('TenantDb.run requires organizationId in the request context');
    }
    return this.transactionWithGucs(organizationId, userId, fn);
  }

  /**
   * User-scoped unit of work for pre-tenant lookups (membership checks,
   * "my organizations") — sets only app.user_id.
   */
  async runAsUser<T>(userId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.transactionWithGucs(undefined, userId, fn);
  }

  private async transactionWithGucs<T>(
    organizationId: string | undefined,
    userId: string | undefined,
    fn: (tx: Database) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        select set_config('app.organization_id', ${organizationId ?? ''}, true),
               set_config('app.user_id', ${userId ?? ''}, true)`);
      return fn(tx as unknown as Database);
    });
  }
}
