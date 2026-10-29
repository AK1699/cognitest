import { createHash, randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, cookieHeader, createTestApp, sessionCookie } from './helpers/test-app';

loadEnv();
const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const run = randomUUID().slice(0, 8);
const EMAIL = `sessions-${run}@sessions.test.local`;
const PASSWORD = 'A-long-secure-passw0rd';
let ipCounter = 1;
const uniqueIp = () => `10.98.0.${ipCounter++}`;

describe('sessions (e2e)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  const instance = () => app.getHttpAdapter().getInstance();
  const login = async () => {
    const res = await instance().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: EMAIL, password: PASSWORD },
      remoteAddress: uniqueIp(),
    });
    const token = sessionCookie(res);
    if (!token) throw new Error('login did not set a session cookie');
    return token;
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await instance().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: EMAIL,
        username: `sessions-${run}`,
        password: PASSWORD,
        displayName: 'Session User',
        organizationName: 'Session Workspace',
      },
      remoteAddress: uniqueIp(),
    });
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%@sessions.test.local`);
    await owner.end();
    await redis.quit();
    await app.close();
  });

  it('GET /auth/me returns the user and live session; no cookie → 401', async () => {
    const token = await login();
    const me = await instance().inject({
      method: 'GET',
      url: '/auth/me',
      headers: cookieHeader(token),
    });
    expect(me.statusCode).toBe(200);
    const body = me.json() as { user: { email: string }; session: { id: string } };
    expect(body.user.email).toBe(EMAIL);
    expect(body.session.id).toBeTruthy();

    expect((await instance().inject({ method: 'GET', url: '/auth/me' })).statusCode).toBe(401);
    expect(
      (
        await instance().inject({
          method: 'GET',
          url: '/auth/me',
          headers: cookieHeader('A'.repeat(43)),
        })
      ).statusCode,
    ).toBe(401);
  });

  it('logout revokes the session — replaying the cookie fails', async () => {
    const token = await login();
    const out = await instance().inject({
      method: 'POST',
      url: '/auth/logout',
      headers: cookieHeader(token),
    });
    expect(out.statusCode).toBe(200);
    expect(
      (await instance().inject({ method: 'GET', url: '/auth/me', headers: cookieHeader(token) }))
        .statusCode,
    ).toBe(401);
  });

  it('survives a Redis flush via the DB fallback and repopulates the cache', async () => {
    const token = await login();
    const hash = createHash('sha256').update(token).digest('hex');
    await redis.del(`sess:${hash}`);

    const me = await instance().inject({
      method: 'GET',
      url: '/auth/me',
      headers: cookieHeader(token),
    });
    expect(me.statusCode).toBe(200);
    expect(await redis.exists(`sess:${hash}`)).toBe(1);
  });

  it('lists sessions with a current flag and revokes one by id', async () => {
    const tokenA = await login();
    const tokenB = await login();

    const list = await instance().inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: cookieHeader(tokenA),
    });
    const sessions = (list.json() as { sessions: { id: string; current: boolean }[] }).sessions;
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    const current = sessions.find((s) => s.current);
    const other = sessions.find((s) => !s.current);
    expect(current && other).toBeTruthy();

    const del = await instance().inject({
      method: 'DELETE',
      url: `/auth/sessions/${other?.id}`,
      headers: cookieHeader(tokenA),
    });
    expect(del.statusCode).toBe(200);
    // tokenB may or may not be the revoked one — assert via the list length shrinking
    const after = await instance().inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: cookieHeader(tokenA),
    });
    expect((after.json() as { sessions: unknown[] }).sessions.length).toBe(sessions.length - 1);
    void tokenB;
  });

  it('logout-all kills every session', async () => {
    const tokenA = await login();
    const tokenB = await login();
    const res = await instance().inject({
      method: 'POST',
      url: '/auth/logout-all',
      headers: cookieHeader(tokenA),
    });
    expect(res.statusCode).toBe(200);
    for (const token of [tokenA, tokenB]) {
      expect(
        (await instance().inject({ method: 'GET', url: '/auth/me', headers: cookieHeader(token) }))
          .statusCode,
      ).toBe(401);
    }
  });

  it('CSRF: a mutating request from a foreign origin is rejected', async () => {
    const token = await login();
    const res = await instance().inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { ...cookieHeader(token), origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
    // same-origin passes
    const ok = await instance().inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { ...cookieHeader(token), origin: 'http://localhost:3000' },
    });
    expect(ok.statusCode).toBe(200);
  });
});
