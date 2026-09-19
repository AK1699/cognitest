import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, createTestApp } from './helpers/test-app';
import { signupUser, uniqueIp } from './helpers/org-fixture';
import type { FixtureUser } from './helpers/org-fixture';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const DOMAIN = 'bootstrap.test.local';

describe('organization bootstrap (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  let user: FixtureUser;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await cleanupUsers(owner, `%@${DOMAIN}`); // stale rows from aborted runs
    user = await signupUser(app, DOMAIN, 'founder');
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it('POST /organizations creates org + admin membership + default team + audit, atomically', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/organizations',
        payload: { name: 'Second Workspace' },
        headers: user.cookie,
        remoteAddress: uniqueIp(),
      });
    expect(res.statusCode).toBe(201);
    const organization = (
      res.json() as { organization: { id: string; slug: string; onboardingStatus: string } }
    ).organization;
    // base slug, or suffixed when an org with the base slug already exists
    expect(organization.slug).toMatch(/^second-workspace(-[a-f0-9]{6})?$/);
    expect(organization.onboardingStatus).toBe('in_progress');

    const [membership] = await owner`select r.key from organization_members om
      join roles r on r.id = om.role_id
      where om.organization_id = ${organization.id} and om.user_id = ${user.id}`;
    expect(membership?.key).toBe('admin');
    const [team] = await owner`select slug from teams where organization_id = ${organization.id}`;
    expect(team?.slug).toBe('general');
    const [teamMember] = await owner`select tm.id from team_members tm
      join teams t on t.id = tm.team_id
      where t.organization_id = ${organization.id} and tm.user_id = ${user.id}`;
    expect(teamMember).toBeTruthy();
    const [audit] = await owner`select action from audit_logs
      where organization_id = ${organization.id} and action = 'ORGANIZATION_CREATED'`;
    expect(audit).toBeTruthy();
  });

  it('slug collisions get a random suffix', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/organizations',
        payload: { name: 'Second Workspace' },
        headers: user.cookie,
        remoteAddress: uniqueIp(),
      });
    expect(res.statusCode).toBe(201);
    const slug = (res.json() as { organization: { slug: string } }).organization.slug;
    expect(slug).toMatch(/^second-workspace-[a-f0-9]{6}$/); // first one exists → suffix
  });

  it('signup without organizationName creates no workspace (wizard path)', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: `wizard-${user.id.slice(0, 8)}@${DOMAIN}`,
          username: `wizard-${user.id.slice(0, 8)}`,
          password: 'A-long-secure-passw0rd',
          displayName: 'Wizard User',
        },
        remoteAddress: uniqueIp(),
      });
    expect(res.statusCode).toBe(201);
    const created = (res.json() as { user: { id: string } }).user;
    const memberships = await owner`select id from organization_members
      where user_id = ${created.id}`;
    expect(memberships.length).toBe(0);
  });

  it('onboarding wizard flow: org without default team → team → completed', async () => {
    const instance = app.getHttpAdapter().getInstance();
    const created = await instance.inject({
      method: 'POST',
      url: '/organizations',
      payload: { name: 'Wizard Workspace', defaultTeam: false },
      headers: user.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(created.statusCode).toBe(201);
    const org = (created.json() as { organization: { id: string; onboardingStep: string } })
      .organization;
    expect(org.onboardingStep).toBe('team');
    const teams = await owner`select id from teams where organization_id = ${org.id}`;
    expect(teams.length).toBe(0);

    const team = await instance.inject({
      method: 'POST',
      url: `/organizations/${org.id}/teams`,
      payload: { name: 'QA Core', slug: 'qa-core' },
      headers: user.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(team.statusCode).toBe(201);

    const done = await instance.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}`,
      payload: { onboardingStatus: 'completed', onboardingStep: null },
      headers: user.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(done.statusCode).toBe(200);
    const [row] = await owner`select onboarding_status, onboarding_completed_at
      from organizations where id = ${org.id}`;
    expect(row?.onboarding_status).toBe('completed');
    expect(row?.onboarding_completed_at).toBeTruthy();
  });

  it('GET /users/me/organizations lists every membership with the org', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/users/me/organizations',
      headers: user.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(res.statusCode).toBe(200);
    const memberships = (
      res.json() as { organizations: { roleKey: string; organization: { name: string } }[] }
    ).organizations;
    expect(memberships.length).toBeGreaterThanOrEqual(3); // signup + two bootstraps
    expect(memberships.every((m) => m.roleKey === 'admin')).toBe(true);
  });
});
