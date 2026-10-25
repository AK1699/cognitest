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

const DOMAIN = 'designs.test.local';

describe('test designs (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  let admin: FixtureUser;
  let analyst: FixtureUser; // business_analyst: may approve, may not delete
  let developer: FixtureUser; // may edit/create, may NOT approve
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
      payload: { key: 'DSN', name: 'Designs' },
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    projectId = (project.json() as { project: { id: string } }).project.id;
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

  it('creates a design and aggregates requirement/suite/case counts', async () => {
    const created = await call('POST', '/designs', analyst, {
      name: 'Checkout design',
      description: 'Payment and failure paths.',
      source: 'manual',
    });
    expect(created.statusCode).toBe(201);
    const design = (created.json() as { design: { id: string; status: string; version: number } })
      .design;
    expect(design.status).toBe('draft');
    expect(design.version).toBe(1);
    const designId = design.id;

    // requirements nested under the design
    const req = await call('POST', `/designs/${designId}/requirements`, analyst, {
      title: 'Card payments succeed',
    });
    expect(req.statusCode).toBe(201);
    const reqList = await call('GET', `/designs/${designId}/requirements`, admin);
    expect((reqList.json() as { requirements: unknown[] }).requirements).toHaveLength(1);

    // a plan + suite + case under the design feeds the aggregate counts
    const plan = await call('POST', `/designs/${designId}/test-plans`, developer, {
      title: 'Checkout plan',
    });
    expect(plan.statusCode).toBe(201);
    const planId = (plan.json() as { testPlan: { id: string } }).testPlan.id;
    const suite = await call('POST', `/test-plans/${planId}/suites`, developer, { title: 'Happy' });
    const suiteId = (suite.json() as { testSuite: { id: string } }).testSuite.id;
    await call('POST', `/test-suites/${suiteId}/cases`, developer, { title: 'Pay with saved card' });

    const summary = await call('GET', `/designs/${designId}`, admin);
    expect((summary.json() as { design: object }).design).toMatchObject({
      requirementCount: 1,
      suiteCount: 1,
      caseCount: 1,
    });

    const list = await call('GET', '/designs', admin);
    const listed = (list.json() as { designs: { id: string }[] }).designs;
    expect(listed.some((d) => d.id === designId)).toBe(true);
  });

  it('runs the approval workflow with the distinct approve permission', async () => {
    const design = (
      (await call('POST', '/designs', developer, { name: 'Approvable' })).json() as {
        design: { id: string };
      }
    ).design;

    // draft cannot be decided; a developer may not approve
    expect(
      (await call('POST', `/designs/${design.id}/decision`, analyst, { decision: 'approved' }))
        .statusCode,
    ).toBe(400);
    expect((await call('POST', `/designs/${design.id}/submit`, developer)).statusCode).toBe(200);
    expect(
      (await call('PATCH', `/designs/${design.id}`, developer, { name: 'x' })).statusCode,
    ).toBe(409); // edit-locked in review
    expect(
      (await call('POST', `/designs/${design.id}/decision`, developer, { decision: 'approved' }))
        .statusCode,
    ).toBe(403); // developer lacks test_design.approve

    const approved = await call('POST', `/designs/${design.id}/decision`, analyst, {
      decision: 'approved',
    });
    expect((approved.json() as { design: { status: string } }).design.status).toBe('approved');

    // editing an approved design bumps the version back to draft (§54)
    const edited = await call('PATCH', `/designs/${design.id}`, admin, { name: 'Approvable v2' });
    expect((edited.json() as { design: { status: string; version: number } }).design).toMatchObject({
      status: 'draft',
      version: 2,
    });
  });

  it('delete is admin-only (test_design.delete) and removes the design', async () => {
    const design = (
      (await call('POST', '/designs', admin, { name: 'To delete' })).json() as {
        design: { id: string };
      }
    ).design;
    expect((await call('DELETE', `/designs/${design.id}`, analyst)).statusCode).toBe(403);
    expect((await call('DELETE', `/designs/${design.id}`, developer)).statusCode).toBe(403);
    expect((await call('DELETE', `/designs/${design.id}`, admin)).statusCode).toBe(200);
    // the design is gone — subsequent reads/edits 404
    expect((await call('GET', `/designs/${design.id}`, admin)).statusCode).toBe(404);
    expect((await call('PATCH', `/designs/${design.id}`, admin, { name: 'no' })).statusCode).toBe(
      404,
    );
  });

  it('deleting a design cascades to its requirements, plans, suites and cases', async () => {
    const design = (
      (await call('POST', '/designs', admin, { name: 'Cascade' })).json() as {
        design: { id: string };
      }
    ).design;
    await call('POST', `/designs/${design.id}/requirements`, admin, { title: 'R' });
    const plan = (
      (await call('POST', `/designs/${design.id}/test-plans`, admin, { title: 'P' })).json() as {
        testPlan: { id: string };
      }
    ).testPlan;
    const suite = (
      (await call('POST', `/test-plans/${plan.id}/suites`, admin, { title: 'S' })).json() as {
        testSuite: { id: string };
      }
    ).testSuite;
    await call('POST', `/test-suites/${suite.id}/cases`, admin, { title: 'C' });

    expect((await call('DELETE', `/designs/${design.id}`, admin)).statusCode).toBe(200);
    // the plan went with it (project-scoped list no longer contains it)
    const plans = await call('GET', `/test-plans`, admin);
    const ids = (plans.json() as { testPlans: { id: string }[] }).testPlans.map((p) => p.id);
    expect(ids).not.toContain(plan.id);
  });

  it('generates a plan + suites + cases from approved requirements (Gherkin → steps)', async () => {
    const design = (
      (await call('POST', '/designs', admin, { name: 'Generatable' })).json() as {
        design: { id: string };
      }
    ).design;

    // a requirement whose description carries a Gherkin scenario
    await call('POST', `/designs/${design.id}/requirements`, admin, {
      title: 'Login',
      description:
        'Users can sign in.\n\n```gherkin\nScenario: valid login\n  Given a registered user\n  When they submit valid credentials\n  Then they reach the dashboard\n```',
    });
    // a second requirement with no Gherkin → placeholder case
    await call('POST', `/designs/${design.id}/requirements`, admin, { title: 'Logout' });

    // cannot generate before approval
    expect((await call('POST', `/designs/${design.id}/generate`, admin)).statusCode).toBe(400);

    await call('POST', `/designs/${design.id}/submit`, admin);
    await call('POST', `/designs/${design.id}/decision`, analyst, { decision: 'approved' });

    const generated = await call('POST', `/designs/${design.id}/generate`, admin);
    expect(generated.statusCode).toBe(200);
    const result = generated.json() as {
      testPlan: { id: string; objective: string; scope: string[]; strategy: string };
      suiteCount: number;
      caseCount: number;
    };
    expect(result.suiteCount).toBe(2); // one suite per requirement
    expect(result.caseCount).toBe(2); // one scenario + one placeholder

    // plan metadata is derived by rules (objective/scope/strategy)
    expect(result.testPlan.objective).toBeTruthy();
    expect(result.testPlan.scope).toEqual(expect.arrayContaining(['Login', 'Logout']));
    // "Users can sign in" → Functional; the login requirement mentions sign-in only
    expect(result.testPlan.strategy).toContain('Functional');

    const plans = await call('GET', `/designs/${design.id}/test-plans`, admin);
    expect((plans.json() as { testPlans: unknown[] }).testPlans).toHaveLength(1);

    // the generated case carries the parsed Given/When/Then steps
    const suites = await call('GET', `/test-plans/${result.testPlan.id}/suites`, admin);
    const loginSuite = (suites.json() as { testSuites: { id: string; title: string }[] }).testSuites.find(
      (s) => s.title === 'Login',
    );
    expect(loginSuite).toBeTruthy();
    const cases = await call('GET', `/test-suites/${loginSuite!.id}/cases`, admin);
    const firstCase = (
      cases.json() as { testCases: { title: string; steps: unknown[] }[] }
    ).testCases[0];
    expect(firstCase?.title).toBe('valid login');
    expect(firstCase?.steps.length).toBeGreaterThan(0);
  });

  it('designs are contained to their project — foreign paths 404', async () => {
    const other = await instance().inject({
      method: 'POST',
      url: `/organizations/${orgId}/projects`,
      payload: { key: 'OTR2', name: 'Other2' },
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    const otherProjectId = (other.json() as { project: { id: string } }).project.id;
    const design = (
      (await call('POST', '/designs', admin, { name: 'Contained' })).json() as {
        design: { id: string };
      }
    ).design;

    const crossed = await instance().inject({
      method: 'GET',
      url: `/organizations/${orgId}/projects/${otherProjectId}/designs/${design.id}`,
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(crossed.statusCode).toBe(404);
  });
});
