import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { auditSchema } from './schemas';

import { organizations } from './organizations';
import { users } from './users';

/**
 * Immutable security/audit trail. No updated_at by design; UPDATE/DELETE are
 * revoked from the app role and no RLS policy permits them.
 */
export const auditLogs = auditSchema.table(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // null = user-scoped security event (login, password reset) with no tenant;
    // such rows are invisible to tenants — only ops tooling reads them
    organizationId: uuid('organization_id').references(() => organizations.id),
    // null for system-originated events
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_org_created_idx').on(t.organizationId, t.createdAt.desc()),
    index('audit_logs_org_resource_idx').on(t.organizationId, t.resourceType, t.resourceId),
  ],
);
