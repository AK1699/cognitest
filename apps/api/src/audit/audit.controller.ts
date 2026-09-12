import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';

import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { auditLogs } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Controller('organizations/:organizationId/audit-logs')
export class AuditController {
  constructor(private readonly tenantDb: TenantDb) {}

  /** Cursor-paginated (createdAt-descending) audit trail for the organization. */
  @RequirePermission('audit_log.read')
  @Get()
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('before') before?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const cursor = before ? new Date(before) : undefined;

    const filters = [
      eq(auditLogs.organizationId, organizationId),
      action ? eq(auditLogs.action, action) : undefined,
      resourceType ? eq(auditLogs.resourceType, resourceType) : undefined,
      actorUserId ? eq(auditLogs.actorUserId, actorUserId) : undefined,
      cursor && !Number.isNaN(cursor.getTime()) ? lt(auditLogs.createdAt, cursor) : undefined,
    ].filter((f) => f !== undefined);

    const entries = await this.tenantDb.run((tx) =>
      tx
        .select()
        .from(auditLogs)
        .where(and(...filters))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit),
    );
    const last = entries.at(-1);
    return { entries, nextCursor: entries.length === limit ? last?.createdAt : null };
  }
}
