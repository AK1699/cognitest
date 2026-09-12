import { randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, createTestApp, sessionCookie } from './helpers/test-app';
import type { CapturingMailer } from './helpers/test-app';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const run = randomUUID().slice(0, 8);
const email = (tag: string) => `${tag}-${run}@signup.test.local`;
const uniqueIp = (() => {
  let n = 1;
  return () => `10.99.${Math.floor(n / 250)}.${(n++ % 250) + 1}`;
})();

function signupBody(tag: string) {
  return {
    email: email(tag),
    username: `${tag}-${run}`,
    password: 'a-long-secure-password',
    displayName: `User ${tag}`,
    organizationName: `${tag} Workspace`,
  };
}

describe('signup and login (e2e)', () => {
  let app: NestFastifyApplication;
  let mailer: CapturingMailer;
  const owner = postgres(ownerUrl, { max: 1 });

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%-${run}@signup.test.local`);
    await owner.end();
    await app.close();
  });

  const inject = (payload: object, ip = uniqueIp()) =>
    app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/auth/signup',
      payload,
      remoteAddress: ip,
    });

  it('creates the user, bootstraps a workspace, sends verification mail, opens a session', async () => {
    const res = await inject(signupBody('alice'));
    expect(res.statusCode).toBe(201);

    const body = res.json() as { user: { id: string; status: string; email: string } };
    expect(body.user.email).toBe(email('alice'));
    expect(body.user.status).toBe('pending_verification');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(sessionCookie(res)).toBeTruthy();

    // workspace bootstrap: org + admin membership + default team + audit row
    const [membership] = await owner`
      select om.organization_id, r.key as role_key from organization_members om
      join roles r on r.id = om.role_id where om.user_id = ${body.user.id}`;
    expect(membership?.role_key).toBe('admin');
    const orgId = membership?.organization_id as string;
    const teams = await owner`select slug from teams where organization_id = ${orgId}`;
    expect(teams.map((t) => t.slug)).toEqual(['general']);
    const [audit] = await owner`select action from audit_logs
      where organization_id = ${orgId} and action = 'ORGANIZATION_CREATED'`;
    expect(audit).toBeTruthy();

    expect(mailer.lastTokenFor(email('alice'))).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('rejects duplicate email with 409 and weak password with 400', async () => {
    expect((await inject(signupBody('alice'))).statusCode).toBe(409);
    expect(
      (await inject({ ...signupBody('weak'), password: 'short' })).statusCode,
    ).toBe(400);
  });

  it('logs in with correct credentials and stamps last_login_at', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: email('alice'), password: 'a-long-secure-password' },
      remoteAddress: uniqueIp(),
    });
    expect(res.statusCode).toBe(200);
    expect(sessionCookie(res)).toBeTruthy();
    const [row] = await owner`select last_login_at from users where email = ${email('alice')}`;
    expect(row?.last_login_at).toBeTruthy();
  });

  it('returns an identical generic 401 for wrong password and unknown email', async () => {
    const instance = app.getHttpAdapter().getInstance();
    const wrongPassword = await instance.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: email('alice'), password: 'wrong-password-here' },
      remoteAddress: uniqueIp(),
    });
    const unknownEmail = await instance.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: email('ghost'), password: 'wrong-password-here' },
      remoteAddress: uniqueIp(),
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.body).toBe(unknownEmail.body);
  });

  it('rejects suspended users with 403', async () => {
    await inject(signupBody('suspended'));
    await owner`update users set status = 'suspended' where email = ${email('suspended')}`;
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: email('suspended'), password: 'a-long-secure-password' },
      remoteAddress: uniqueIp(),
    });
    expect(res.statusCode).toBe(403);
  });

  it('rate limits signup per IP', async () => {
    const fixedIp = '10.99.250.1';
    let limited = false;
    for (let i = 0; i < 7; i++) {
      const res = await inject({ ...signupBody(`rate${i}`), email: email(`rate${i}`) }, fixedIp);
      if (res.statusCode === 429) limited = true;
    }
    expect(limited).toBe(true);
  });
});
