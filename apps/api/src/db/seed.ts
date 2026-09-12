import { and, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  PERMISSION_KEYS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_DESCRIPTIONS,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
  parsePermissionKey,
} from '@cognitest/shared';
import type { SystemRole } from '@cognitest/shared';

import { loadEnv } from '../config/load-env';
import { permissions, rolePermissions, roles } from './schema';

function describePermission(key: string): string {
  const { resource, action } = parsePermissionKey(key as (typeof PERMISSION_KEYS)[number]);
  return `${action.charAt(0).toUpperCase()}${action.slice(1)} ${resource.replaceAll('_', ' ')}s`;
}

/**
 * Seeds the permission catalogue, the six system roles and their permission
 * mappings. Idempotent and convergent — catalogue metadata is upserted and
 * system-role mappings are reconciled (stale rows deleted, missing inserted),
 * so editing the matrix in @cognitest/shared and re-seeding takes effect.
 */
export async function runSeed(): Promise<void> {
  loadEnv();
  const url =
    process.env.DATABASE_URL_MIGRATIONS ??
    process.env.DATABASE_URL ??
    'postgres://cognitest:cognitest@localhost:5432/cognitest';
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  try {
    await db
      .insert(permissions)
      .values(
        PERMISSION_KEYS.map((key) => {
          const { resource, action } = parsePermissionKey(key);
          return { key, resource, action, description: describePermission(key) };
        }),
      )
      .onConflictDoUpdate({
        target: permissions.key,
        set: {
          resource: sql`excluded.resource`,
          action: sql`excluded.action`,
          description: sql`excluded.description`,
        },
      });

    await db
      .insert(roles)
      .values(
        SYSTEM_ROLES.map((key) => ({
          key,
          name: SYSTEM_ROLE_NAMES[key],
          description: SYSTEM_ROLE_DESCRIPTIONS[key],
          organizationId: null,
          isSystem: true,
        })),
      )
      .onConflictDoUpdate({
        target: [roles.organizationId, roles.key],
        set: { name: sql`excluded.name`, description: sql`excluded.description` },
      });

    const permissionRows = await db.select().from(permissions);
    const permissionIdByKey = new Map(permissionRows.map((p) => [p.key, p.id]));
    const systemRoles = await db.select().from(roles).where(isNull(roles.organizationId));

    for (const role of systemRoles) {
      const keys = SYSTEM_ROLE_PERMISSIONS[role.key as SystemRole] ?? [];
      const desiredIds = keys.flatMap((key) => permissionIdByKey.get(key) ?? []);
      if (desiredIds.length > 0) {
        await db
          .delete(rolePermissions)
          .where(
            and(
              inArray(rolePermissions.roleId, [role.id]),
              notInArray(rolePermissions.permissionId, desiredIds),
            ),
          );
        await db
          .insert(rolePermissions)
          .values(desiredIds.map((permissionId) => ({ roleId: role.id, permissionId })))
          .onConflictDoNothing();
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => console.log('seed applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
