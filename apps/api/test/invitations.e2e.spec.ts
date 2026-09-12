import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, createTestApp } from './helpers/test-app';
import type { CapturingMailer } from './helpers/test-app';
import { organizationOf, signupUser, uniqueIp } from './helpers/org-fixture';
import type { FixtureUser } from './helpers/org-fixture';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const DOMAIN = 'invite.test.local';

describe('invitation lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let mailer: CapturingMailer;
  const owner = postgres(ownerUrl, { max: 1 });
  let admin: FixtureUser;
  let orgId: string;
  let testerRoleId: string;
  let teamId: string;

  const instance = () => app.getHttpAdapter().getInstance();
  const invite = (email: string, extra: object = {}) =>
    instance().inject({
      method: 'POST',
      url: `/organizations/${orgId}/invitations`,
      payload: { email, roleId: testerRoleId, teamId, ...extra },
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
  const accept = (user: FixtureUser, token: string | null) =>
    instance().inject({
      method: 'POST',
      url: '/invitations/accept',
      payload: { token },
      headers: user.cookie,
      remoteAddress: uniqueIp(),
    });

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
    await cleanupUsers(owner, `%@${DOMAIN}`); // stale rows from aborted runs
    admin = await signupUser(app, DOMAIN, 'owner');
    orgId = await organizationOf(owner, admin.id);
    const [role] = await owner`select id from roles where key = 'tester' and is_system`;
    testerRoleId = role?.id as string;
    const [team] = await owner`select id from teams where organization_id = ${orgId}`;
    teamId = team?.id as string;
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%@${DOMAIN}`);
    await owner.end();
    await app.close();
  });

  it('full lifecycle: invite → mail → accept → membership + team membership', async () => {
    const invitee = await signupUser(app, DOMAIN, 'invitee');

    const created = await invite(invitee.email);
    expect(created.statusCode).toBe(201);
    expect(created.body).not.toContain('tokenHash');

    const token = mailer.lastTokenFor(invitee.email);
    expect(token).toBeTruthy();

    const accepted = await accept(invitee, token);
    expect(accepted.statusCode).toBe(200);
    expect((accepted.json() as { organizationId: string }).organizationId).toBe(orgId);

    const [membership] = await owner`select r.key from organization_members om
      join roles r on r.id = om.role_id
      where om.organization_id = ${orgId} and om.user_id = ${invitee.id}`;
    expect(membership?.key).toBe('tester');
    const [teamMembership] = await owner`select id from team_members
      where team_id = ${teamId} and user_id = ${invitee.id}`;
    expect(teamMembership).toBeTruthy();

    // single-use
    expect((await accept(invitee, token)).statusCode).toBe(400);
    const [row] = await owner`select status, accepted_at from invitations
      where organization_id = ${orgId} and email = ${invitee.email}`;
    expect(row?.status).toBe('accepted');
    expect(row?.accepted_at).toBeTruthy();
  });

  it('rejects acceptance by a different email address', async () => {
    const target = `target-only@${DOMAIN}`;
    await invite(target);
    const token = mailer.lastTokenFor(target);

    const wrongUser = await signupUser(app, DOMAIN, 'imposter');
    expect((await accept(wrongUser, token)).statusCode).toBe(403);
  });

  it('blocks a second pending invitation for the same address', async () => {
    const email = `dupe@${DOMAIN}`;
    expect((await invite(email)).statusCode).toBe(201);
    expect((await invite(email)).statusCode).toBe(409);
  });

  it('revoked invitations cannot be accepted', async () => {
    const email = `revoked@${DOMAIN}`;
    const created = await invite(email);
    const invitationId = (created.json() as { invitation: { id: string } }).invitation.id;
    const token = mailer.lastTokenFor(email);

    const revoke = await instance().inject({
      method: 'DELETE',
      url: `/organizations/${orgId}/invitations/${invitationId}`,
      headers: admin.cookie,
      remoteAddress: uniqueIp(),
    });
    expect(revoke.statusCode).toBe(200);

    const user = await signupUser(app, DOMAIN, 'revoked');
    await owner`update users set email = ${email} where id = ${user.id}`;
    expect((await accept(user, token)).statusCode).toBe(400);
  });

  it('expired invitations are rejected lazily', async () => {
    const email = `late@${DOMAIN}`;
    await invite(email);
    const token = mailer.lastTokenFor(email);
    await owner`update invitations set expires_at = now() - interval '1 hour'
      where organization_id = ${orgId} and email = ${email}`;

    const user = await signupUser(app, DOMAIN, 'late');
    await owner`update users set email = ${email} where id = ${user.id}`;
    expect((await accept(user, token)).statusCode).toBe(400);
  });
});
