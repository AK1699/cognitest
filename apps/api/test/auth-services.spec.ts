import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import { CryptoService } from '../src/auth/services/crypto.service';
import { PasswordService } from '../src/auth/services/password.service';
import { TokenService } from '../src/auth/services/token.service';
import { loadEnv } from '../src/config/load-env';
import type { Env } from '../src/config/env.schema';
import type { Database } from '../src/db/db.tokens';
import { runMigrations } from '../src/db/migrate';

loadEnv();
const url =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.DATABASE_URL ??
  'postgres://cognitest:cognitest@localhost:5432/cognitest';
const client = postgres(url, { max: 1 });
const db = drizzle(client) as unknown as Database;

const fakeConfig = {
  get: (key: string) =>
    key === 'AUTH_SECRET' ? 'test-secret-0123456789-0123456789-0123456789' : undefined,
} as unknown as ConfigService<Env, true>;

const crypto = new CryptoService(fakeConfig);
const userId = randomUUID();

beforeAll(async () => {
  await runMigrations();
  await client`insert into users (id, email, display_name)
    values (${userId}, ${`tokens-${userId}@test.local`}, 'Token User')`;
});

afterAll(async () => {
  await client`delete from users where id = ${userId}`; // auth_tokens cascade
  await client.end();
});

describe('CryptoService', () => {
  it('generates 43-char base64url tokens and stable hashes', () => {
    const token = crypto.generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(crypto.sha256(token)).toBe(crypto.sha256(token));
    expect(crypto.sha256(token)).not.toBe(crypto.sha256(crypto.generateToken()));
  });

  it('hashes IPs deterministically and keyed', () => {
    expect(crypto.hashIp('203.0.113.7')).toBe(crypto.hashIp('203.0.113.7'));
    expect(crypto.hashIp('203.0.113.7')).not.toBe(crypto.sha256('203.0.113.7'));
    expect(crypto.hashIp(undefined)).toBeNull();
  });

  it('round-trips AES-256-GCM and rejects tampering', () => {
    const secret = 'provider-refresh-token';
    const sealed = crypto.encrypt(secret);
    expect(crypto.decrypt(sealed)).toBe(secret);
    const tampered = Buffer.from(sealed, 'base64');
    const lastByte = tampered.at(-1) ?? 0;
    tampered.writeUInt8(lastByte ^ 0xff, tampered.length - 1);
    expect(() => crypto.decrypt(tampered.toString('base64'))).toThrow();
  });
});

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hash = await passwords.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await passwords.verify(hash, 'correct horse battery staple')).toBe(true);
    expect(await passwords.verify(hash, 'wrong password')).toBe(false);
    expect(await passwords.verify('not-a-hash', 'whatever')).toBe(false);
  });

  it('dummy verify always fails', async () => {
    expect(await passwords.verifyDummy('anything')).toBe(false);
  });
});

describe('TokenService', () => {
  const tokens = new TokenService(db, crypto);

  it('issues and consumes a token exactly once', async () => {
    const { raw } = await tokens.issue(userId, 'email_verification');
    expect(await tokens.consume(raw, 'email_verification')).toBe(userId);
    expect(await tokens.consume(raw, 'email_verification')).toBeNull();
  });

  it('rejects wrong-type and expired tokens', async () => {
    const { raw } = await tokens.issue(userId, 'password_reset');
    expect(await tokens.consume(raw, 'email_verification')).toBeNull();
    await client`update auth_tokens set expires_at = now() - interval '1 minute'
      where token_hash = ${crypto.sha256(raw)}`;
    expect(await tokens.consume(raw, 'password_reset')).toBeNull();
  });

  it('issuing invalidates outstanding tokens of the same type', async () => {
    const first = await tokens.issue(userId, 'password_reset');
    const second = await tokens.issue(userId, 'password_reset');
    expect(await tokens.consume(first.raw, 'password_reset')).toBeNull();
    expect(await tokens.consume(second.raw, 'password_reset')).toBe(userId);
  });
});
