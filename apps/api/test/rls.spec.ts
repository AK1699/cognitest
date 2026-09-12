import { randomUUID } from 'node:crypto';

import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { runMigrations } from '../src/db/migrate';

loadEnv();
const OWNER_URL =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';
// always test as the RLS-subject runtime role, whatever the env points at
const appUrl = new URL(OWNER_URL);
appUrl.username = 'cognitest_app';
appUrl.password = 'cognitest_app';

// owner (superuser in dev/CI) seeds fixtures; app is the RLS-subject runtime role
const owner = postgres(OWNER_URL, { max: 1 });
const app = postgres(appUrl.toString(), { max: 1 });

const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const teamA = randomUUID();
const teamB = randomUUID();
const projectA = randomUUID();
const projectB = randomUUID();

async function setContext(organizationId: string | null, userId: string | null = null) {
  await app`select set_config('app.organization_id', ${organizationId ?? ''}, false),
                   set_config('app.user_id', ${userId ?? ''}, false)`;
}

/** Tenant tables checked for cross-org isolation, keyed by their org column filter. */
const TENANT_TABLES = [
  'organization_members',
  'teams',
  'team_members',
  'projects',
  'project_members',
  'invitations',
  'audit_logs',
] as const;

async function cleanup() {
  // FK-safe order; fixtures use throwaway UUIDs so this only touches our rows
  await owner`delete from audit_logs where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from invitations where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from project_members where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from projects where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from team_members where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from teams where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from organization_members where organization_id in (${orgA}, ${orgB})`;
  await owner`delete from organizations where id in (${orgA}, ${orgB})`;
  await owner`delete from users where id in (${userA}, ${userB})`;
}

beforeAll(async () => {
  await runMigrations();
  await cleanup();

  await owner`insert into users (id, email, display_name) values
    (${userA}, ${`rls-a-${userA}@test.local`}, 'RLS User A'),
    (${userB}, ${`rls-b-${userB}@test.local`}, 'RLS User B')`;
  await owner`insert into organizations (id, name, slug) values
    (${orgA}, 'RLS Org A', ${`rls-org-a-${orgA.slice(0, 8)}`}),
    (${orgB}, 'RLS Org B', ${`rls-org-b-${orgB.slice(0, 8)}`})`;
  const [adminRole] = await owner`select id from roles where key = 'admin' and is_system`;
  const roleId = (adminRole as { id: string }).id;
  await owner`insert into organization_members (organization_id, user_id, role_id) values
    (${orgA}, ${userA}, ${roleId}), (${orgB}, ${userB}, ${roleId})`;
  await owner`insert into teams (id, organization_id, name, slug) values
    (${teamA}, ${orgA}, 'Team A', 'general'), (${teamB}, ${orgB}, 'Team B', 'general')`;
  await owner`insert into team_members (team_id, organization_id, user_id) values
    (${teamA}, ${orgA}, ${userA}), (${teamB}, ${orgB}, ${userB})`;
  await owner`insert into projects (id, organization_id, key, name, created_by) values
    (${projectA}, ${orgA}, 'PRJA', 'Project A', ${userA}),
    (${projectB}, ${orgB}, 'PRJB', 'Project B', ${userB})`;
  await owner`insert into project_members (project_id, organization_id, user_id) values
    (${projectA}, ${orgA}, ${userA}), (${projectB}, ${orgB}, ${userB})`;
  await owner`insert into invitations (organization_id, email, role_id, token_hash, invited_by, expires_at) values
    (${orgA}, 'invite-a@test.local', ${roleId}, ${`hash-a-${orgA}`}, ${userA}, now() + interval '7 days'),
    (${orgB}, 'invite-b@test.local', ${roleId}, ${`hash-b-${orgB}`}, ${userB}, now() + interval '7 days')`;
  await owner`insert into audit_logs (organization_id, actor_user_id, action, resource_type) values
    (${orgA}, ${userA}, 'ORGANIZATION_CREATED', 'organization'),
    (${orgB}, ${userB}, 'ORGANIZATION_CREATED', 'organization')`;
});

afterAll(async () => {
  await cleanup();
  await owner.end();
  await app.end();
});

describe('row-level security', () => {
  it('meta: every table with an organization_id column has RLS enabled', async () => {
    const rows = await owner`
      select n.nspname || '.' || c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id'
      where n.nspname in ('public','identity','tenancy','access','product','audit')
        and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  it('org A context sees only org A rows in every tenant table', async () => {
    await setContext(orgA, userA);
    for (const table of TENANT_TABLES) {
      const rows = await app`
        select organization_id from ${app(table)}
        where organization_id in (${orgA}, ${orgB})`;
      expect(rows.length, table).toBeGreaterThan(0);
      expect(
        rows.every((r) => r.organization_id === orgA),
        `${table} leaked cross-tenant rows`,
      ).toBe(true);
    }
    const orgs = await app`select id from organizations where id in (${orgA}, ${orgB})`;
    expect(orgs.map((r) => r.id)).toEqual([orgA]);
  });

  it('no context set → zero rows everywhere (fail closed)', async () => {
    await setContext(null, null);
    for (const table of ['organizations', ...TENANT_TABLES]) {
      const rows = await app`select 1 from ${app(table)} limit 5`;
      expect(rows.length, table).toBe(0);
    }
  });

  it('members can list their own memberships and organizations without org context', async () => {
    await setContext(null, userA);
    const memberships = await app`select organization_id from organization_members
      where user_id = ${userA}`;
    expect(memberships.map((r) => r.organization_id)).toEqual([orgA]);
    const orgs = await app`select id from organizations where id in (${orgA}, ${orgB})`;
    expect(orgs.map((r) => r.id)).toEqual([orgA]);
  });

  it('writes into another tenant are rejected by WITH CHECK', async () => {
    await setContext(orgA, userA);
    await expect(
      app`insert into teams (organization_id, name, slug) values (${orgB}, 'sneaky', 'sneaky')`,
    ).rejects.toThrow(/row-level security/);
    await expect(
      app`update projects set name = 'stolen' where id = ${projectB}`,
    ).resolves.toHaveProperty('count', 0); // row invisible — no-op, not an error
  });

  it('audit_logs are append-only for the app role', async () => {
    await setContext(orgA, userA);
    await expect(app`update audit_logs set action = 'TAMPERED'
      where organization_id = ${orgA}`).rejects.toThrow(/permission denied/);
    await expect(app`delete from audit_logs
      where organization_id = ${orgA}`).rejects.toThrow(/permission denied/);
  });

  it('system roles are readable but immutable for the app role', async () => {
    await setContext(orgA, userA);
    const systemRoles = await app`select key from roles where is_system`;
    expect(systemRoles.length).toBe(6);
    const updated = await app`update roles set name = 'hijack' where key = 'admin' and is_system`;
    expect(updated.count).toBe(0); // filtered out by the update policy, silent no-op
    await expect(
      app`insert into roles (organization_id, key, name, is_system) values (null, 'rogue', 'Rogue', true)`,
    ).rejects.toThrow(/row-level security/);
  });
});
