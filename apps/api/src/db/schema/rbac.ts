import { boolean, index, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';

export const roles = pgTable(
  'roles',
  {
    id: id(),
    // null = system role shared by every organization
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    // NULLS NOT DISTINCT (pg15+) so system roles (org_id null) are unique too —
    // without it duplicate system roles pass the constraint and the seed's
    // onConflictDoNothing never fires
    unique('roles_org_name_uq').on(t.organizationId, t.name).nullsNotDistinct(),
    index('roles_organization_id_idx').on(t.organizationId),
  ],
);

export const permissions = pgTable('permissions', {
  id: id(),
  // format: resource:ACTION, e.g. project:READ — catalogue lives in @cognitest/shared
  key: text('key').notNull().unique(),
  ...timestamps,
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
