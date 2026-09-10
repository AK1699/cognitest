import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { ORG_STATUSES } from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { roles } from './rbac';
import { users } from './users';

export const orgStatus = pgEnum('org_status', ORG_STATUSES);

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: orgStatus('status').notNull().default('active'),
  ...timestamps,
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    roleId: uuid('role_id').references(() => roles.id),
    ...timestamps,
  },
  (t) => [
    unique('organization_members_org_user_uq').on(t.organizationId, t.userId),
    index('organization_members_organization_id_idx').on(t.organizationId),
  ],
);
