import { randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, cookieHeader, createTestApp, sessionCookie } from './helpers/test-app';
import type { CapturingMailer } from './helpers/test-app';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const run = randomUUID().slice(0, 8);
const EMAIL = `mailflow-${run}@mail.test.local`;
const PASSWORD = 'a-long-secure-password';
let ipCounter = 1;
const uniqueIp = () => `10.97.0.${ipCounter++}`;

describe('email verification and password reset (e2e)', () => {
  let app: NestFastifyApplication;
  let mailer: CapturingMailer;
  const owner = postgres(ownerUrl, { max: 1 });
  const instance = () => app.getHttpAdapter().getInstance();

  const post = (url: string, payload: object) =>
    instance().inject({ method: 'POST', url, payload, remoteAddress: uniqueIp() });

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
    await post('/auth/signup', {
      email: EMAIL,
      username: `mailflow-${run}`,
      password: PASSWORD,
      displayName: 'Mail User',
      organizationName: 'Mail Workspace',
    });
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%@mail.test.local`);
    await owner.end();
    await app.close();
  });

  it('verifies the email with the mailed token, exactly once', async () => {
    const token = mailer.lastTokenFor(EMAIL);
    expect(token).toBeTruthy();

    const ok = await post('/auth/verify-email', { token });
    expect(ok.statusCode).toBe(200);
    const [user] = await owner`select status, email_verified_at from users where email = ${EMAIL}`;
    expect(user?.status).toBe('active');
    expect(user?.email_verified_at).toBeTruthy();

    // single-use
    expect((await post('/auth/verify-email', { token })).statusCode).toBe(400);
  });

  it('resend invalidates the previous token; verified users get nothing', async () => {
    await owner`update users set status = 'pending_verification', email_verified_at = null
      where email = ${EMAIL}`;
    await post('/auth/resend-verification', { email: EMAIL });
    const first = mailer.lastTokenFor(EMAIL);
    await post('/auth/resend-verification', { email: EMAIL });
    const second = mailer.lastTokenFor(EMAIL);
    expect(first).not.toBe(second);
    expect((await post('/auth/verify-email', { token: first })).statusCode).toBe(400);
    expect((await post('/auth/verify-email', { token: second })).statusCode).toBe(200);

    const sentBefore = mailer.sent.length;
    const res = await post('/auth/resend-verification', { email: EMAIL });
    expect(res.statusCode).toBe(200); // generic response...
    expect(mailer.sent.length).toBe(sentBefore); // ...but no mail for a verified address
  });

  it('expired verification tokens are rejected', async () => {
    await owner`update users set status = 'pending_verification', email_verified_at = null
      where email = ${EMAIL}`;
    await post('/auth/resend-verification', { email: EMAIL });
    const token = mailer.lastTokenFor(EMAIL);
    await owner`update auth_tokens set expires_at = now() - interval '1 minute'
      where consumed_at is null and type = 'email_verification'
      and user_id = (select id from users where email = ${EMAIL})`;
    expect((await post('/auth/verify-email', { token })).statusCode).toBe(400);
    await owner`update users set status = 'active', email_verified_at = now()
      where email = ${EMAIL}`;
  });

  it('forgot-password is enumeration-safe', async () => {
    const sentBefore = mailer.sent.length;
    const res = await post('/auth/forgot-password', { email: `ghost-${run}@mail.test.local` });
    expect(res.statusCode).toBe(200);
    expect(mailer.sent.length).toBe(sentBefore);
  });

  it('reset-password rotates the credential, revokes sessions, single-use token', async () => {
    const loginRes = await post('/auth/login', { email: EMAIL, password: PASSWORD });
    const liveToken = sessionCookie(loginRes);
    expect(liveToken).toBeTruthy();

    await post('/auth/forgot-password', { email: EMAIL });
    const resetToken = mailer.lastTokenFor(EMAIL);
    expect(resetToken).toBeTruthy();

    const newPassword = 'an-even-longer-password';
    expect(
      (await post('/auth/reset-password', { token: resetToken, password: newPassword })).statusCode,
    ).toBe(200);

    // all sessions revoked
    expect(
      (
        await instance().inject({
          method: 'GET',
          url: '/auth/me',
          headers: cookieHeader(liveToken ?? ''),
        })
      ).statusCode,
    ).toBe(401);
    // old password dead, new one works
    expect((await post('/auth/login', { email: EMAIL, password: PASSWORD })).statusCode).toBe(401);
    expect((await post('/auth/login', { email: EMAIL, password: newPassword })).statusCode).toBe(200);
    // token single-use
    expect(
      (await post('/auth/reset-password', { token: resetToken, password: newPassword })).statusCode,
    ).toBe(400);
  });
});
