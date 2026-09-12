import { Injectable, Logger } from '@nestjs/common';

import type { AuditAction } from '@cognitest/shared';

import { RequestContextService } from '../common/context/request-context.service';
import { CryptoService } from '../auth/services/crypto.service';
import { TenantDb } from '../db/tenant-db.service';
import { auditLogs } from '../db/schema';
import type { Database } from '../db/db.tokens';

export interface AuditEntry {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  /** Override the context org (e.g. invitation accept before TenantGuard ran). */
  organizationId?: string;
}

/**
 * Writes the immutable audit trail. Two modes:
 * - log(entry, tx): same-transaction — an authz mutation must not commit
 *   without its audit row (spec §30). Pass the TenantDb transaction.
 * - log(entry): fire-and-forget for non-mutating events (logins); failures are
 *   logged, never break the request.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly ctx: RequestContextService,
    private readonly tenantDb: TenantDb,
    private readonly crypto: CryptoService,
  ) {}

  async log(entry: AuditEntry, tx?: Database): Promise<void> {
    const store = this.ctx.get();
    const organizationId = entry.organizationId ?? store?.organizationId ?? null;
    const actorUserId = store?.userId ?? null;
    const row = {
      organizationId,
      actorUserId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ipHash: this.crypto.hashIp(store?.ip),
      userAgent: store?.userAgent ?? null,
    };

    if (tx) {
      await tx.insert(auditLogs).values(row);
      return;
    }

    try {
      if (organizationId) {
        await this.tenantDb.run(async (t) => {
          await t.insert(auditLogs).values(row);
        });
      } else if (actorUserId) {
        // user-scoped security event — RLS permits it via app.user_id
        await this.tenantDb.runAsUser(actorUserId, async (t) => {
          await t.insert(auditLogs).values(row);
        });
      } else {
        this.logger.warn(`audit event ${entry.action} dropped: no org or actor in context`);
      }
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'audit write failed');
    }
  }
}
