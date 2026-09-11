import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { citext, id, timestamps } from './helpers';
import { organizations } from './organizations';
import { users } from './users';

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: citext('email').notNull(),
    // plain column for now — the roles table arrives with the RBAC migration
    roleId: uuid('role_id'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('invitations_organization_id_idx').on(t.organizationId)],
);
