import { foreignKey, index, pgEnum, text, unique, uuid } from 'drizzle-orm/pg-core';

import { productSchema } from './schemas';

import { PROJECT_STATUSES } from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';
import { teams } from './teams';
import { users } from './users';

export const projectStatus = pgEnum('project_status', PROJECT_STATUSES);

export const projects = productSchema.table(
  'projects',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    // every project belongs to a team: org > team > project
    teamId: uuid('team_id').notNull(),
    // short human identifier unique within the org, e.g. CORE
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: projectStatus('status').notNull().default('active'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('projects_org_key_uq').on(t.organizationId, t.key),
    unique('projects_id_org_uq').on(t.id, t.organizationId),
    index('projects_organization_id_idx').on(t.organizationId),
    index('projects_team_id_idx').on(t.teamId),
    // composite FK pins the team to the same tenant; restrict blocks deleting
    // a team that still owns projects
    foreignKey({
      name: 'projects_team_org_fk',
      columns: [t.teamId, t.organizationId],
      foreignColumns: [teams.id, teams.organizationId],
    }).onDelete('restrict'),
  ],
);

/**
 * Explicit binary project access (spec §86): membership gates access, the org
 * role supplies the permissions. Holders of project.configure (admin/manager)
 * implicitly access every project without a row here.
 */
export const projectMembers = productSchema.table(
  'project_members',
  {
    id: id(),
    projectId: uuid('project_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('project_members_project_user_uq').on(t.projectId, t.userId),
    index('project_members_organization_id_idx').on(t.organizationId),
    foreignKey({
      name: 'project_members_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
  ],
);
