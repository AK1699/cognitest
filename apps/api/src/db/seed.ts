import { isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { PERMISSION_KEYS, SYSTEM_ROLES, SYSTEM_ROLE_PERMISSIONS } from '@cognitest/shared';
import type { SystemRole } from '@cognitest/shared';

import { loadEnv } from '../config/load-env';
import { permissions, rolePermissions, roles } from './schema';

const ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  owner: 'Full access to everything in the organization',
  admin: 'Full administrative access',
  member: 'Works on test artefacts and runs executions',
  viewer: 'Read-only access',
};

/**
 * Seeds the permission catalogue, the four system roles and their permission
 * mappings. Idempotent — every insert is onConflictDoNothing, so re-running
 * changes nothing (relies on roles_org_name_uq being NULLS NOT DISTINCT).
 */
export async function runSeed(): Promise<void> {
  loadEnv();
  const url =
    process.env.DATABASE_URL ?? 'postgres://cognitest:cognitest@localhost:5432/cognitest';
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  try {
    await db
      .insert(permissions)
      .values(PERMISSION_KEYS.map((key) => ({ key })))
      .onConflictDoNothing({ target: permissions.key });

    await db
      .insert(roles)
      .values(
        SYSTEM_ROLES.map((name) => ({
          name,
          description: ROLE_DESCRIPTIONS[name],
          organizationId: null,
          isSystem: true,
        })),
      )
      .onConflictDoNothing();

    const permissionRows = await db.select().from(permissions);
    const permissionIdByKey = new Map(permissionRows.map((p) => [p.key, p.id]));
    const systemRoles = await db.select().from(roles).where(isNull(roles.organizationId));

    const mappings = systemRoles.flatMap((role) => {
      const keys = SYSTEM_ROLE_PERMISSIONS[role.name as SystemRole] ?? [];
      return keys.flatMap((key) => {
        const permissionId = permissionIdByKey.get(key);
        return permissionId ? [{ roleId: role.id, permissionId }] : [];
      });
    });
    if (mappings.length > 0) {
      await db.insert(rolePermissions).values(mappings).onConflictDoNothing();
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
