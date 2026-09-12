import { foreignKey, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';
import { users } from './users';

export const teams = pgTable(
  'teams',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    ...timestamps,
  },
  (t) => [
    unique('teams_org_slug_uq').on(t.organizationId, t.slug),
    // composite target for team_members' cross-tenant-proof FK
    unique('teams_id_org_uq').on(t.id, t.organizationId),
    index('teams_organization_id_idx').on(t.organizationId),
  ],
);

/**
 * Team membership inherits the member's organization role — teams are grouping
 * and visibility only (spec §27 decision); a role override column is additive
 * later if the product needs it.
 */
export const teamMembers = pgTable(
  'team_members',
  {
    id: id(),
    teamId: uuid('team_id').notNull(),
    // denormalised so the composite FK + RLS pin the row to the team's tenant
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('team_members_team_user_uq').on(t.teamId, t.userId),
    index('team_members_organization_id_idx').on(t.organizationId),
    foreignKey({
      name: 'team_members_team_org_fk',
      columns: [t.teamId, t.organizationId],
      foreignColumns: [teams.id, teams.organizationId],
    }).onDelete('cascade'),
  ],
);
