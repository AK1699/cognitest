import { randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// canned provider claims, mutated per test
const mockState = { claims: {} as Record<string, unknown>, failGrant: false };

vi.mock('openid-client', () => ({
  discovery: vi.fn(() => Promise.resolve({ issuer: 'mock' })),
  randomPKCECodeVerifier: vi.fn(() => 'mock-code-verifier'),
  calculatePKCECodeChallenge: vi.fn(() => Promise.resolve('mock-challenge')),
  randomState: vi.fn(() => `state-${randomUUID()}`),
  randomNonce: vi.fn(() => 'mock-nonce'),
  buildAuthorizationUrl: vi.fn(
    (_config: unknown, params: Record<string, string>) =>
      new URL(`https://provider.example/authorize?state=${params.state}`),
  ),
  authorizationCodeGrant: vi.fn(() => {
    if (mockState.failGrant) throw new Error('grant failed');
    return Promise.resolve({ claims: () => mockState.claims });
  }),
}));

import { loadEnv } from '../src/config/load-env';
import { cleanupUsers, createTestApp, sessionCookie } from './helpers/test-app';

loadEnv();
process.env.GOOGLE_CLIENT_ID = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.MICROSOFT_CLIENT_ID = 'test-ms-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-ms-secret';

const ownerUrl =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';

const run = randomUUID().slice(0, 8);
let ipCounter = 1;
const uniqueIp = () => `10.96.0.${ipCounter++}`;

describe('OIDC (e2e, mocked provider)', () => {
  let app: NestFastifyApplication;
  const owner = postgres(ownerUrl, { max: 1 });
  const instance = () => app.getHttpAdapter().getInstance();

  /** Runs the start → callback dance and returns the callback response. */
  async function completeFlow(provider: string) {
    const start = await instance().inject({
      method: 'GET',
      url: `/auth/oidc/${provider}/start?redirectTo=/dashboard`,
      remoteAddress: uniqueIp(),
    });
    expect(start.statusCode).toBe(302);
    const state = new URL(start.headers.location as string).searchParams.get('state');
    return instance().inject({
      method: 'GET',
      url: `/auth/oidc/${provider}/callback?code=mock-code&state=${state}`,
      remoteAddress: uniqueIp(),
    });
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await cleanupUsers(owner, `%@oidc.test.local`);
    await owner.end();
    await app.close();
  });

  it('first Google login creates the user and sends them to onboarding (no auto-workspace)', async () => {
    mockState.failGrant = false;
    mockState.claims = {
      sub: `google-sub-${run}`,
      email: `new-${run}@oidc.test.local`,
      email_verified: true,
      name: 'OIDC Newcomer',
      picture: 'https://example.com/avatar.png',
    };

    const res = await completeFlow('google');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/onboarding');
    expect(sessionCookie(res)).toBeTruthy();

    const [user] = await owner`select id, status, email_verified_at, password_hash, username
      from users where email = ${`new-${run}@oidc.test.local`}`;
    expect(user?.status).toBe('active');
    expect(user?.email_verified_at).toBeTruthy();
    expect(user?.password_hash).toBeNull();
    expect(user?.username).toBeNull();
    // the onboarding wizard creates the organization — none exists yet
    const memberships = await owner`select id from organization_members
      where user_id = ${user?.id}`;
    expect(memberships.length).toBe(0);
  });

  it('second Google login reuses the account and honours redirectTo', async () => {
    const res = await completeFlow('google');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/dashboard');
    const count = await owner`select count(*)::int as n from users
      where email = ${`new-${run}@oidc.test.local`}`;
    expect(count[0]?.n).toBe(1);
  });

  it('auto-links a verified Google identity to an existing password account', async () => {
    const email = `linkme-${run}@oidc.test.local`;
    await instance().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email,
        username: `linkme-${run}`,
        password: 'A-long-secure-passw0rd',
        displayName: 'Link Me',
        organizationName: 'Link Workspace',
      },
      remoteAddress: uniqueIp(),
    });

    mockState.claims = {
      sub: `google-sub-link-${run}`,
      email,
      email_verified: true,
      name: 'Link Me',
    };
    const res = await completeFlow('google');
    expect(res.statusCode).toBe(302);
    expect(sessionCookie(res)).toBeTruthy();

    const rows = await owner`select oa.provider from oauth_accounts oa
      join users u on u.id = oa.user_id where u.email = ${email}`;
    expect(rows.map((r) => r.provider)).toEqual(['google']);
    const users = await owner`select count(*)::int as n from users where email = ${email}`;
    expect(users[0]?.n).toBe(1); // linked, not duplicated
  });

  it('never auto-links Microsoft by email — redirects with account_exists', async () => {
    const email = `linkme-${run}@oidc.test.local`; // exists from the previous test
    mockState.claims = {
      sub: `ms-sub-${run}`,
      email,
      email_verified: true,
      name: 'MS Impersonator',
    };
    const res = await completeFlow('microsoft');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/login?error=account_exists');
    expect(sessionCookie(res)).toBeFalsy();
  });

  it('rejects a callback with an unknown state', async () => {
    const res = await instance().inject({
      method: 'GET',
      url: `/auth/oidc/google/callback?code=x&state=state-${randomUUID()}`,
      remoteAddress: uniqueIp(),
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/login?error=oidc_failed');
  });

  it('state is single-use — replaying a callback fails', async () => {
    mockState.claims = {
      sub: `google-sub-${run}`,
      email: `new-${run}@oidc.test.local`,
      email_verified: true,
    };
    const start = await instance().inject({
      method: 'GET',
      url: '/auth/oidc/google/start',
      remoteAddress: uniqueIp(),
    });
    const state = new URL(start.headers.location as string).searchParams.get('state');
    const url = `/auth/oidc/google/callback?code=mock-code&state=${state}`;
    const first = await instance().inject({ method: 'GET', url, remoteAddress: uniqueIp() });
    expect(sessionCookie(first)).toBeTruthy();
    const replay = await instance().inject({ method: 'GET', url, remoteAddress: uniqueIp() });
    expect(replay.headers.location).toBe('http://localhost:3000/login?error=oidc_failed');
  });

  it('provider error param redirects with oidc_denied', async () => {
    const res = await instance().inject({
      method: 'GET',
      url: '/auth/oidc/google/callback?error=access_denied',
      remoteAddress: uniqueIp(),
    });
    expect(res.headers.location).toBe('http://localhost:3000/login?error=oidc_denied');
  });

  it('unknown provider is a 404', async () => {
    const res = await instance().inject({
      method: 'GET',
      url: '/auth/oidc/github/start',
      remoteAddress: uniqueIp(),
    });
    expect(res.statusCode).toBe(404);
  });
});
