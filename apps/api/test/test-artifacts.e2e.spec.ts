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

const DOMAIN = 'artifacts.test.local';

describe('test artefacts (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  let admin: FixtureUser;
  let analyst: FixtureUser; // business_analyst: may approve, may not delete
  let developer: FixtureUser; // may edit/execute, may NOT approve
  let orgId: string;
  let projectId: string;

  const instance = () => app.getHttpAdapter().getInstance();
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    user: FixtureUser,
    payload?: object,
  ) =>
    instance().inject({
      method,
      url: `/organizations/${orgId}/projects/${projectId}${url}`,
      payload,
      headers: user.cookie,
      remoteAddress: uniqueIp(),
    });

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await cleanupUsers(owner, `%@${DOMAIN}`);
    admin = await signupUser(app, DOMAIN, 'admin');
    orgId = await organizationOf(owner, admin.id);
    analyst = await signupUser(app, DOMAIN, 'analyst');
    developer = await signupUser(app, DOMAIN, 'developer');
    await addMemberWithRole(owner, orgId, analyst.id, 'business_analyst');
    await addMemberWithRole(owner, orgId, developer.id, 'developer');

    const project = await instance().inject({
      method: 'POST',
      url: `/organizations/${orgId}/projects`,
      payload: { key: 'ART', name: 'Artefacts' },
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    projectId = (project.json() as { project: { id: string } }).project.id;
    // analyst + developer need explicit project access (binary membership)
    for (const user of [analyst, developer]) {
      await instance().inject({
        method: 'POST',
        url: `/organizations/${orgId}/projects/${projectId}/members`,
        payload: { userId: user.id },
        headers: admin.cookie,
        remoteAddress: uniqueIp(),
      });
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it('builds the full chain: requirement → plan → suite → case', async () => {
    const requirement = await call('POST', '/requirements', analyst, {
      title: 'Login must be rate limited',
      description: 'Five attempts per minute per IP.',
    });
    expect(requirement.statusCode).toBe(201);
    const requirementId = (requirement.json() as { requirement: { id: string } }).requirement.id;

    const plan = await call('POST', '/test-plans', analyst, {
      title: 'Auth hardening plan',
      requirementId,
    });
    expect(plan.statusCode).toBe(201);
    const planBody = (plan.json() as { testPlan: { id: string; status: string; version: number } })
      .testPlan;
    expect(planBody.status).toBe('draft');
    expect(planBody.version).toBe(1);

    const suite = await call('POST', `/test-plans/${planBody.id}/suites`, developer, {
      title: 'Rate limiting',
    });
    expect(suite.statusCode).toBe(201);
    const suiteId = (suite.json() as { testSuite: { id: string } }).testSuite.id;

    const testCase = await call('POST', `/test-suites/${suiteId}/cases`, developer, {
      title: 'Sixth login attempt within a minute is rejected',
      steps: [
        { action: 'POST /auth/login five times with a wrong password' },
        { action: 'POST /auth/login a sixth time', expected: 'HTTP 429' },
      ],
      priority: 'high',
    });
    expect(testCase.statusCode).toBe(201);

    const list = await call('GET', `/test-suites/${suiteId}/cases`, admin);
    expect((list.json() as { testCases: unknown[] }).testCases.length).toBe(1);
  });

  it('runs the approval workflow with the distinct approve permission', async () => {
    const plan = await call('POST', '/test-plans', developer, { title: 'Session plan' });
    const planId = (plan.json() as { testPlan: { id: string } }).testPlan.id;

    // draft cannot be decided; submitting requires draft
    expect(
      (await call('POST', `/test-plans/${planId}/decision`, analyst, { decision: 'approved' }))
        .statusCode,
    ).toBe(400);

    expect((await call('POST', `/test-plans/${planId}/submit`, developer)).statusCode).toBe(200);

    // in_review is edit-locked, and a developer may not approve
    expect(
      (await call('PATCH', `/test-plans/${planId}`, developer, { title: 'x' })).statusCode,
    ).toBe(409);
    expect(
      (await call('POST', `/test-plans/${planId}/decision`, developer, { decision: 'approved' }))
        .statusCode,
    ).toBe(403);

    // the analyst rejects → back to draft with the decision recorded
    const rejection = await call('POST', `/test-plans/${planId}/decision`, analyst, {
      decision: 'rejected',
      comment: 'Missing logout coverage',
    });
    expect(rejection.statusCode).toBe(200);
    expect((rejection.json() as { testPlan: { status: string } }).testPlan.status).toBe('draft');

    // resubmit the same version and approve
    await call('POST', `/test-plans/${planId}/submit`, developer);
    const approval = await call('POST', `/test-plans/${planId}/decision`, analyst, {
      decision: 'approved',
    });
    expect(
      (approval.json() as { testPlan: { status: string; version: number } }).testPlan,
    ).toMatchObject({ status: 'approved', version: 1 });

    const approvals = await call('GET', `/test-plans/${planId}/approvals`, admin);
    const rows = (
      approvals.json() as {
        approvals: { version: number; status: string; comment: string | null }[];
      }
    ).approvals;
    expect(rows).toHaveLength(1); // one row per version — rejection was overwritten by resubmit
    expect(rows[0]).toMatchObject({ version: 1, status: 'approved' });
  });

  it('editing an approved plan bumps the version back to draft (spec §54)', async () => {
    const plan = await call('POST', '/test-plans', admin, { title: 'Versioned plan' });
    const planId = (plan.json() as { testPlan: { id: string } }).testPlan.id;
    await call('POST', `/test-plans/${planId}/submit`, admin);
    await call('POST', `/test-plans/${planId}/decision`, analyst, { decision: 'approved' });

    const edited = await call('PATCH', `/test-plans/${planId}`, admin, {
      title: 'Versioned plan v2',
    });
    const body = (edited.json() as { testPlan: { status: string; version: number } }).testPlan;
    expect(body).toMatchObject({ status: 'draft', version: 2 });

    // the new version needs its own approval row
    await call('POST', `/test-plans/${planId}/submit`, admin);
    await call('POST', `/test-plans/${planId}/decision`, analyst, { decision: 'approved' });
    const approvals = await call('GET', `/test-plans/${planId}/approvals`, admin);
    expect((approvals.json() as { approvals: unknown[] }).approvals).toHaveLength(2);
  });

  it('artefacts are contained to their project — foreign paths 404', async () => {
    const otherProject = await instance().inject({
      method: 'POST',
      url: `/organizations/${orgId}/projects`,
      payload: { key: 'OTHR', name: 'Other' },
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    const otherProjectId = (otherProject.json() as { project: { id: string } }).project.id;

    const plan = await call('POST', '/test-plans', admin, { title: 'Contained plan' });
    const planId = (plan.json() as { testPlan: { id: string } }).testPlan.id;

    const crossed = await instance().inject({
      method: 'GET',
      url: `/organizations/${orgId}/projects/${otherProjectId}/test-plans/${planId}`,
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(crossed.statusCode).toBe(404);
  });

  it('archive is admin-only (test_plan.delete) and locks the plan', async () => {
    const plan = await call('POST', '/test-plans', admin, { title: 'To archive' });
    const planId = (plan.json() as { testPlan: { id: string } }).testPlan.id;

    expect((await call('DELETE', `/test-plans/${planId}`, analyst)).statusCode).toBe(403);
    expect((await call('DELETE', `/test-plans/${planId}`, developer)).statusCode).toBe(403);
    expect((await call('DELETE', `/test-plans/${planId}`, admin)).statusCode).toBe(200);
    expect(
      (await call('PATCH', `/test-plans/${planId}`, admin, { title: 'nope' })).statusCode,
    ).toBe(409);
  });
});
