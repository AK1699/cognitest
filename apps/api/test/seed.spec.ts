import postgres from 'postgres';
import { beforeAll, describe, expect, it } from 'vitest';

import { PERMISSION_KEYS, SYSTEM_ROLES, SYSTEM_ROLE_PERMISSIONS } from '@cognitest/shared';

import { loadEnv } from '../src/config/load-env';
import { runMigrations } from '../src/db/migrate';
import { runSeed } from '../src/db/seed';

loadEnv();
const url = process.env.DATABASE_URL ?? 'postgres://cognitest:cognitest@localhost:5432/cognitest';

interface Counts {
  permissions: number;
  systemRoles: number;
  rolePermissions: number;
}

async function counts(): Promise<Counts> {
  const client = postgres(url, { max: 1 });
  try {
    const [permissions, systemRoles, rolePermissions] = await Promise.all([
      client`select count(*)::int as count from permissions`,
      client`select count(*)::int as count from roles where organization_id is null and is_system`,
      client`select count(*)::int as count from role_permissions`,
    ]);
    return {
      permissions: permissions[0]?.count as number,
      systemRoles: systemRoles[0]?.count as number,
      rolePermissions: rolePermissions[0]?.count as number,
    };
  } finally {
    await client.end();
  }
}

describe('seed', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('creates the catalogue and system roles, idempotently', async () => {
    await runSeed();
    const first = await counts();

    const expectedMappings = SYSTEM_ROLES.reduce(
      (sum, role) => sum + SYSTEM_ROLE_PERMISSIONS[role].length,
      0,
    );
    expect(first.permissions).toBe(PERMISSION_KEYS.length);
    expect(first.systemRoles).toBe(SYSTEM_ROLES.length);
    expect(first.rolePermissions).toBe(expectedMappings);

    // second run must not create anything new
    await runSeed();
    expect(await counts()).toEqual(first);
  });
});
