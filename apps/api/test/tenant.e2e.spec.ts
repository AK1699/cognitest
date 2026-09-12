import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, createTestApp } from './helpers/test-app';
import { addMemberWithRole, organizationOf, signupUser, uniqueIp } from './helpers/org-fixture';
import type { FixtureUser } from './helpers/org-fixture';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const DOMAIN = 'tenant.test.local';

describe('tenant isolation (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  let alice: FixtureUser;
  let bob: FixtureUser;
  let orgA: string;
  let orgB: string;

  const get = (url: string, user: FixtureUser) =>
    app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url, headers: user.cookie, remoteAddress: uniqueIp() });

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await cleanupUsers(owner, `%@${DOMAIN}`); // stale rows from aborted runs
    alice = await signupUser(app, DOMAIN, 'alice');
    bob = await signupUser(app, DOMAIN, 'bob');
    orgA = await organizationOf(owner, alice.id);
    orgB = await organizationOf(owner, bob.id);
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it("a member of org A gets 404 on org B's routes — existence is not disclosed", async () => {
    expect((await get(`/organizations/${orgB}`, alice)).statusCode).toBe(404);
    expect((await get(`/organizations/${orgB}/teams`, alice)).statusCode).toBe(404);
    expect((await get(`/organizations/${orgB}/members`, alice)).statusCode).toBe(404);
    // own org still fine
    expect((await get(`/organizations/${orgA}`, alice)).statusCode).toBe(200);
  });

  it('suspended members lose access (cache invalidated synchronously)', async () => {
    // bob joins org A, sees it, then is suspended
    await addMemberWithRole(owner, orgA, bob.id, 'viewer');
    expect((await get(`/organizations/${orgA}`, bob)).statusCode).toBe(200);

    await owner`update organization_members set status = 'suspended'
      where organization_id = ${orgA} and user_id = ${bob.id}`;
    // direct DB edit bypasses the service invalidation hook — mimic it
    const redis = (await import('ioredis')).default;
    const r = new redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    await r.del(`authz:member:${orgA}:${bob.id}`);
    await r.quit();

    expect((await get(`/organizations/${orgA}`, bob)).statusCode).toBe(404);
  });

  it('role changes through the API take effect immediately', async () => {
    const charlie = await signupUser(app, DOMAIN, 'charlie');
    await addMemberWithRole(owner, orgA, charlie.id, 'viewer');
    // viewer cannot create teams
    const denied = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: `/organizations/${orgA}/teams`,
      payload: { name: 'C', slug: 'c-team' },
      headers: charlie.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(denied.statusCode).toBe(403);

    // alice (admin) promotes charlie to manager via the API → cache invalidated
    const [member] = await owner`select id from organization_members
      where organization_id = ${orgA} and user_id = ${charlie.id}`;
    const [managerRole] = await owner`select id from roles where key = 'manager' and is_system`;
    const promote = await app.getHttpAdapter().getInstance().inject({
      method: 'PATCH',
      url: `/organizations/${orgA}/members/${member?.id}`,
      payload: { roleId: managerRole?.id },
      headers: alice.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(promote.statusCode).toBe(200);

    const allowed = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: `/organizations/${orgA}/teams`,
      payload: { name: 'C', slug: 'c-team' },
      headers: charlie.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(allowed.statusCode).toBe(201);
  });

  it('the last admin cannot be removed or downgraded', async () => {
    const [member] = await owner`select om.id from organization_members om
      join roles r on r.id = om.role_id
      where om.organization_id = ${orgA} and r.key = 'admin'`;
    const [viewerRole] = await owner`select id from roles where key = 'viewer' and is_system`;

    const downgrade = await app.getHttpAdapter().getInstance().inject({
      method: 'PATCH',
      url: `/organizations/${orgA}/members/${member?.id}`,
      payload: { roleId: viewerRole?.id },
      headers: alice.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(downgrade.statusCode).toBe(400);

    const remove = await app.getHttpAdapter().getInstance().inject({
      method: 'DELETE',
      url: `/organizations/${orgA}/members/${member?.id}`,
      headers: alice.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(remove.statusCode).toBe(400);
  });

  it('project access is explicit: non-configure members only see their projects', async () => {
    const dave = await signupUser(app, DOMAIN, 'dave');
    await addMemberWithRole(owner, orgA, dave.id, 'tester');

    // alice creates a project without dave
    const created = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: `/organizations/${orgA}/projects`,
      payload: { key: 'SECR', name: 'Secret' },
      headers: alice.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(created.statusCode).toBe(201);
    const projectId = (created.json() as { project: { id: string } }).project.id;

    // dave: not listed, direct access 404
    const list = await get(`/organizations/${orgA}/projects`, dave);
    expect(
      (list.json() as { projects: { id: string }[] }).projects.some((p) => p.id === projectId),
    ).toBe(false);
    expect((await get(`/organizations/${orgA}/projects/${projectId}`, dave)).statusCode).toBe(404);

    // membership grants access
    const add = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: `/organizations/${orgA}/projects/${projectId}/members`,
      payload: { userId: dave.id },
      headers: alice.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(add.statusCode).toBe(201);
    expect((await get(`/organizations/${orgA}/projects/${projectId}`, dave)).statusCode).toBe(200);
  });
});
