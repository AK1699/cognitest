import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SYSTEM_ROLES } from '@cognitest/shared';
import type { SystemRole } from '@cognitest/shared';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, createTestApp } from './helpers/test-app';
import { addMemberWithRole, organizationOf, signupUser, uniqueIp } from './helpers/org-fixture';
import type { FixtureUser } from './helpers/org-fixture';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const DOMAIN = 'matrix.test.local';

/** Expected status per role for representative routes (spec §25 matrix). */
interface Check {
  name: string;
  request: (orgId: string, extra: { teamId: string }) => { method: string; url: string; payload?: object };
  expected: Record<SystemRole, number>;
}

const CHECKS: Check[] = [
  {
    name: 'GET org (organization.read) — everyone',
    request: (orgId) => ({ method: 'GET', url: `/organizations/${orgId}` }),
    expected: { admin: 200, manager: 200, tester: 200, business_analyst: 200, developer: 200, viewer: 200 },
  },
  {
    name: 'PATCH org (organization.update) — admin only',
    request: (orgId) => ({ method: 'PATCH', url: `/organizations/${orgId}`, payload: { name: 'Renamed' } }),
    expected: { admin: 200, manager: 403, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
  },
  {
    name: 'POST team (team.create) — admin + manager',
    request: (orgId) => ({
      method: 'POST',
      url: `/organizations/${orgId}/teams`,
      payload: { name: 'X', slug: `x-${Math.random().toString(36).slice(2, 8)}` },
    }),
    expected: { admin: 201, manager: 201, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
  },
  {
    name: 'DELETE team (team.delete) — admin only',
    request: (orgId, { teamId }) => ({ method: 'DELETE', url: `/organizations/${orgId}/teams/${teamId}` }),
    // non-2xx callers must not delete; run admin last so the fixture team survives
    expected: { admin: 200, manager: 403, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
  },
  {
    name: 'POST project (project.create) — everyone but viewer',
    request: (orgId) => ({
      method: 'POST',
      url: `/organizations/${orgId}/projects`,
      payload: { key: `P${Math.random().toString(36).slice(2, 6).toUpperCase()}`, name: 'P' },
    }),
    expected: { admin: 201, manager: 201, tester: 201, business_analyst: 201, developer: 201, viewer: 403 },
  },
  {
    name: 'POST invitation (invitation.create) — admin + manager',
    request: (orgId) => ({
      method: 'POST',
      url: `/organizations/${orgId}/invitations`,
      payload: { email: `inv-${Math.random().toString(36).slice(2, 8)}@${DOMAIN}`, roleId: '' },
    }),
    expected: { admin: 400, manager: 400, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
    // roleId '' fails validation with 400 — enough to prove the permission gate
  },
  {
    name: 'GET audit logs (audit_log.read) — admin + manager',
    request: (orgId) => ({ method: 'GET', url: `/organizations/${orgId}/audit-logs` }),
    expected: { admin: 200, manager: 200, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
  },
  {
    name: 'GET roles (role.read) — admin + manager',
    request: (orgId) => ({ method: 'GET', url: `/organizations/${orgId}/roles` }),
    expected: { admin: 200, manager: 200, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
  },
  {
    name: 'POST role (role.create) — admin only',
    request: (orgId) => ({
      method: 'POST',
      url: `/organizations/${orgId}/roles`,
      payload: { key: `custom_${Math.random().toString(36).slice(2, 8)}`, name: 'Custom' },
    }),
    expected: { admin: 201, manager: 403, tester: 403, business_analyst: 403, developer: 403, viewer: 403 },
  },
  {
    name: 'GET members (member.read) — everyone',
    request: (orgId) => ({ method: 'GET', url: `/organizations/${orgId}/members` }),
    expected: { admin: 200, manager: 200, tester: 200, business_analyst: 200, developer: 200, viewer: 200 },
  },
];

describe('authorization matrix (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  const usersByRole = new Map<SystemRole, FixtureUser>();
  let orgId: string;
  let teamId: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await cleanupUsers(owner, `%@${DOMAIN}`); // stale rows from aborted runs
    const admin = await signupUser(app, DOMAIN, 'admin');
    usersByRole.set('admin', admin);
    orgId = await organizationOf(owner, admin.id);

    for (const role of SYSTEM_ROLES.filter((r) => r !== 'admin')) {
      const user = await signupUser(app, DOMAIN, role.replace('_', '-'));
      await addMemberWithRole(owner, orgId, user.id, role);
      usersByRole.set(role, user);
    }

    const [team] = await owner`insert into teams (organization_id, name, slug)
      values (${orgId}, 'Matrix Team', 'matrix-team') returning id`;
    teamId = team?.id as string;
  }, 120_000);

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it.each(CHECKS)('$name', async (check) => {
    // admin last: destructive admin-only calls must not break later roles
    const order: SystemRole[] = ['viewer', 'developer', 'business_analyst', 'tester', 'manager', 'admin'];
    for (const role of order) {
      const user = usersByRole.get(role);
      if (!user) throw new Error(`missing fixture user for ${role}`);
      const { method, url, payload } = check.request(orgId, { teamId });
      const res = await app.getHttpAdapter().getInstance().inject({
        method: method as 'GET',
        url,
        payload,
        headers: user.cookie,
        remoteAddress: uniqueIp(),
      });
      expect(res.statusCode, `${role} → ${method} ${url}`).toBe(check.expected[role]);
    }
  });
});
