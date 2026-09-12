import { index, pgEnum, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { tenancySchema } from './schemas';
import { sql } from 'drizzle-orm';

import { INVITATION_STATUSES } from '@cognitest/shared';

import { citext, id, timestamps } from './helpers';
import { organizations } from './organizations';
import { roles } from './rbac';
import { teams } from './teams';
import { users } from './users';

export const invitationStatus = pgEnum('invitation_status', INVITATION_STATUSES);

export const invitations = tenancySchema.table(
  'invitations',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: citext('email').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    // optional: accepted invitee also joins this team
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    status: invitationStatus('status').notNull().default('pending'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('invitations_organization_id_idx').on(t.organizationId),
    // one live invitation per address per org; revoke before re-inviting
    uniqueIndex('invitations_org_email_pending_uq')
      .on(t.organizationId, t.email)
      .where(sql`${t.status} = 'pending'`),
  ],
);
