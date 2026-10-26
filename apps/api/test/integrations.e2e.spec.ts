import { randomUUID } from 'node:crypto';

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

const DOMAIN = 'integrations.test.local';

/**
 * These tests never let a request reach a real provider: connect-validation,
 * permission and tenant-isolation paths all short-circuit before any outbound
 * HTTP. The live provider clients are exercised manually against real accounts.
 */
describe('integrations (e2e)', () => {
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
  const inject = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, user: FixtureUser, payload?: object) =>
    instance().inject({ method, url, payload, headers: user.cookie, remoteAddress: uniqueIp() });

  const proj = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, user: FixtureUser, payload?: object) =>
    inject(method, `/organizations/${orgId}/projects/${projectId}${url}`, user, payload);

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

    projectId = await createProject(orgId, admin, 'INT');
    otherProjectId = await createProject(otherOrgId, outsider, 'OUT');
    // viewer needs explicit project access for the project-scoped link routes
    await proj('POST', '/members', admin, { userId: viewer.id });

    // Seed a connected JIRA integration directly (no network) for link/isolation tests.
    await owner`insert into product.integration_connections
      (organization_id, provider, status, config, secret_encrypted, account_label, created_by)
      values (${orgId}, 'jira', 'connected', ${JSON.stringify({ baseUrl: 'https://x.atlassian.net', email: 'a@x.io' })},
              'enc', 'Seed Account', ${admin.id})`;
  }, 60_000);

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it('lists connections without ever exposing the secret', async () => {
    const res = await inject('GET', `/organizations/${orgId}/integrations`, admin);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { integrations: Record<string, unknown>[] };
    const jira = body.integrations.find((i) => i.provider === 'jira');
    expect(jira).toMatchObject({ provider: 'jira', status: 'connected', accountLabel: 'Seed Account' });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('enc');
  });

  it('gates connecting on integration.configure (viewer is read-only)', async () => {
    expect((await inject('GET', `/organizations/${orgId}/integrations`, viewer)).statusCode).toBe(200);
    const denied = await inject('PUT', `/organizations/${orgId}/integrations/github`, viewer, {
      token: 'ghp_x',
    });
    expect(denied.statusCode).toBe(403);
    // disconnect is admin-only (integration.delete)
    expect(
      (await inject('DELETE', `/organizations/${orgId}/integrations/jira`, viewer)).statusCode,
    ).toBe(403);
  });

  it('rejects connect payloads missing required provider fields (before any network call)', async () => {
    // JIRA needs baseUrl + email
    const jira = await inject('PUT', `/organizations/${orgId}/integrations/jira`, admin, {
      token: 'secret-token',
    });
    expect(jira.statusCode).toBe(400);
    // Bitbucket needs a username
    const bitbucket = await inject('PUT', `/organizations/${orgId}/integrations/bitbucket`, admin, {
      token: 'app-password',
    });
    expect(bitbucket.statusCode).toBe(400);
  });

  it('404s for an unknown provider', async () => {
    expect(
      (await inject('GET', `/organizations/${orgId}/integrations/gitlab`, admin)).statusCode,
    ).toBe(404);
  });

  it('search and import require the provider to be connected', async () => {
    // notion is not connected → 404 before any outbound request
    expect(
      (await inject('GET', `/organizations/${orgId}/integrations/notion/search?q=hello`, admin))
        .statusCode,
    ).toBe(404);
    const importRes = await proj('POST', '/integrations/import-requirements', admin, {
      provider: 'notion',
      keys: ['abc'],
    });
    expect(importRes.statusCode).toBe(404);
  });

  it('creates, lists and removes an external link (url supplied → no network)', async () => {
    const entityId = randomUUID();
    const created = await proj('POST', '/external-links', admin, {
      provider: 'jira',
      entityType: 'requirement',
      entityId,
      externalKey: 'AX-42',
      externalUrl: 'https://x.atlassian.net/browse/AX-42',
      title: 'Rate limit login',
      state: 'In Progress',
    });
    expect(created.statusCode).toBe(201);
    const linkId = (created.json() as { link: { id: string } }).link.id;

    const list = await proj(
      'GET',
      `/external-links?entityType=requirement&entityId=${entityId}`,
      viewer,
    );
    expect(list.statusCode).toBe(200);
    expect((list.json() as { links: unknown[] }).links).toHaveLength(1);

    // viewer may read but not remove (integration.delete)
    expect((await proj('DELETE', `/external-links/${linkId}`, viewer)).statusCode).toBe(403);
    expect((await proj('DELETE', `/external-links/${linkId}`, admin)).statusCode).toBe(200);
    const after = await proj(
      'GET',
      `/external-links?entityType=requirement&entityId=${entityId}`,
      admin,
    );
    expect((after.json() as { links: unknown[] }).links).toHaveLength(0);
  });

  it('links are tenant-isolated — a foreign org cannot see or delete them', async () => {
    const entityId = randomUUID();
    const created = await proj('POST', '/external-links', admin, {
      provider: 'jira',
      entityType: 'requirement',
      entityId,
      externalKey: 'AX-99',
      externalUrl: 'https://x.atlassian.net/browse/AX-99',
    });
    const linkId = (created.json() as { link: { id: string } }).link.id;

    // same entityId queried from the outsider's own org/project → RLS hides it
    const foreignList = await inject(
      'GET',
      `/organizations/${otherOrgId}/projects/${otherProjectId}/external-links?entityType=requirement&entityId=${entityId}`,
      outsider,
    );
    expect(foreignList.statusCode).toBe(200);
    expect((foreignList.json() as { links: unknown[] }).links).toHaveLength(0);

    // deleting orgA's link through the outsider's org 404s (invisible row)
    const foreignDelete = await inject(
      'DELETE',
      `/organizations/${otherOrgId}/projects/${otherProjectId}/external-links/${linkId}`,
      outsider,
    );
    expect(foreignDelete.statusCode).toBe(404);
  });

  it('a non-member cannot reach another org (TenantGuard 404s outsiders)', async () => {
    expect(
      (await inject('GET', `/organizations/${orgId}/integrations`, outsider)).statusCode,
    ).toBe(404);
  });
});
