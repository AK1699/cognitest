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

const DOMAIN = 'automation.test.local';

describe('automation (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  let admin: FixtureUser;
  let viewer: FixtureUser;
  let outsider: FixtureUser; // owns a separate org, used for cross-tenant checks
  let orgId: string;
  let projectId: string;
  let otherOrgId: string;
  let otherProjectId: string;

  const instance = () => app.getHttpAdapter().getInstance();
  const inject = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    user: FixtureUser,
    payload?: object,
  ) => instance().inject({ method, url, payload, headers: user.cookie, remoteAddress: uniqueIp() });

  const proj = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    user: FixtureUser,
    payload?: object,
  ) => inject(method, `/organizations/${orgId}/projects/${projectId}${url}`, user, payload);

  async function createProject(org: string, user: FixtureUser, key: string): Promise<string> {
    const res = await inject('POST', `/organizations/${org}/projects`, user, { key, name: key });
    return (res.json() as { project: { id: string } }).project.id;
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await cleanupUsers(owner, `%@${DOMAIN}`);
    admin = await signupUser(app, DOMAIN, 'admin');
    orgId = await organizationOf(owner, admin.id);
    viewer = await signupUser(app, DOMAIN, 'viewer');
    await addMemberWithRole(owner, orgId, viewer.id, 'viewer');

    outsider = await signupUser(app, DOMAIN, 'outsider');
    otherOrgId = await organizationOf(owner, outsider.id);

    projectId = await createProject(orgId, admin, 'AUT');
    otherProjectId = await createProject(otherOrgId, outsider, 'OTH');
    // viewer needs explicit project access to reach the project-scoped routes
    await proj('POST', '/members', admin, { userId: viewer.id });
  }, 60_000);

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it('creates an automation and derives summary counts', async () => {
    const res = await proj('POST', '/automations', admin, {
      name: 'Login Automation',
      description: 'Automate the login flow',
      method: 'visual',
      framework: 'playwright',
      tags: ['login', 'auth'],
    });
    expect(res.statusCode).toBe(201);
    const { automation } = res.json() as { automation: Record<string, unknown> };
    expect(automation).toMatchObject({
      name: 'Login Automation',
      method: 'visual',
      framework: 'playwright',
      status: 'draft',
      testCount: 0,
      passedCount: 0,
      failedCount: 0,
      lastRunStatus: null,
    });
    expect(automation.tags).toEqual(['login', 'auth']);
  });

  it('rejects an automation with a blank name (400 before insert)', async () => {
    const res = await proj('POST', '/automations', admin, { name: '' });
    expect(res.statusCode).toBe(400);
  });

  it('gates create/delete/execute on the role (viewer is read-only)', async () => {
    expect((await proj('GET', '/automations', viewer)).statusCode).toBe(200);
    const denied = await proj('POST', '/automations', viewer, { name: 'nope' });
    expect(denied.statusCode).toBe(403);
  });

  it('runs the full automation lifecycle: tests, generate, run, results', async () => {
    const created = await proj('POST', '/automations', admin, { name: 'Checkout Flow' });
    const automationId = (created.json() as { automation: { id: string } }).automation.id;
    const base = `/automations/${automationId}`;

    // a manually-authored test, auto-keyed TC-001 with a generated code stub
    const t1 = await proj('POST', `${base}/tests`, admin, {
      title: 'Valid login',
      priority: 'high',
      steps: [{ action: 'Open the application' }, { action: 'Enter valid credentials' }],
      expectedResult: 'User is logged in',
    });
    expect(t1.statusCode).toBe(201);
    const test1 = (t1.json() as { test: Record<string, unknown> }).test;
    expect(test1).toMatchObject({ key: 'TC-001', title: 'Valid login', lastStatus: 'not_run' });
    expect(String(test1.code)).toContain('@playwright/test');

    // generate synthesises a starter test when the project has no test cases
    const gen = await proj('POST', `${base}/generate`, admin);
    expect(gen.statusCode).toBe(200);
    expect((gen.json() as { generated: number }).generated).toBeGreaterThanOrEqual(1);

    // mark the first test failed so the run reflects a mixed outcome
    await proj('PATCH', `${base}/tests/${String(test1.id)}`, admin, { status: 'failed' });

    const run = await proj('POST', `${base}/runs`, admin, { browser: 'chromium', environment: 'staging' });
    expect(run.statusCode).toBe(201);
    const runBody = (run.json() as { run: Record<string, unknown> }).run;
    expect(runBody.status).toBe('failed'); // one failed test → overall failed
    expect(runBody.failed).toBe(1);
    expect(Number(runBody.passed)).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(runBody.results)).toBe(true);
    expect(Array.isArray(runBody.logs)).toBe(true);

    // the run cannot be cancelled once completed
    const cancel = await proj('POST', `${base}/runs/${String(runBody.id)}/cancel`, admin);
    expect(cancel.statusCode).toBe(400);

    // summary now reflects the run and failed test
    const summary = await proj('GET', base, admin);
    const s = (summary.json() as { automation: Record<string, unknown> }).automation;
    expect(s.lastRunStatus).toBe('failed');
    expect(Number(s.failedCount)).toBe(1);
  });

  it('refuses to run an automation with no tests', async () => {
    const created = await proj('POST', '/automations', admin, { name: 'Empty' });
    const automationId = (created.json() as { automation: { id: string } }).automation.id;
    const run = await proj('POST', `/automations/${automationId}/runs`, admin, {});
    expect(run.statusCode).toBe(400);
  });

  it('deletes an automation and 404s afterwards', async () => {
    const created = await proj('POST', '/automations', admin, { name: 'Throwaway' });
    const automationId = (created.json() as { automation: { id: string } }).automation.id;
    expect((await proj('DELETE', `/automations/${automationId}`, viewer)).statusCode).toBe(403);
    expect((await proj('DELETE', `/automations/${automationId}`, admin)).statusCode).toBe(200);
    expect((await proj('GET', `/automations/${automationId}`, admin)).statusCode).toBe(404);
  });

  it('is tenant-isolated — a non-member cannot reach the project (404)', async () => {
    expect((await proj('GET', '/automations', outsider)).statusCode).toBe(404);
    // and the outsider's own project never sees this org's automations
    const foreign = await inject(
      'GET',
      `/organizations/${otherOrgId}/projects/${otherProjectId}/automations`,
      outsider,
    );
    expect(foreign.statusCode).toBe(200);
    expect((foreign.json() as { automations: unknown[] }).automations).toHaveLength(0);
  });
});
