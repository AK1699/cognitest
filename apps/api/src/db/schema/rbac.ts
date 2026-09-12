import { boolean, index, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';

import { accessSchema } from './schemas';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';

export const roles = accessSchema.table(
  'roles',
  {
    id: id(),
    // null = system role shared by every organization
    organizationId: uuid('organization_id').references(() => organizations.id),
    // stable machine identifier, e.g. business_analyst; name is the display label
    key: text('key').notNull(),
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
    unique('roles_org_key_uq').on(t.organizationId, t.key).nullsNotDistinct(),
    index('roles_organization_id_idx').on(t.organizationId),
  ],
);

export const permissions = accessSchema.table('permissions', {
  id: id(),
  // format: resource.action, e.g. test_plan.approve — catalogue lives in @cognitest/shared
  key: text('key').notNull().unique(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
  ...timestamps,
});

export const rolePermissions = accessSchema.table(
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
