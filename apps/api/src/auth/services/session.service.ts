import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type Redis from 'ioredis';

import { REDIS } from '../../redis/redis.module';
import type { Env } from '../../config/env.schema';
import { DRIZZLE } from '../../db/db.tokens';
import type { Database } from '../../db/db.tokens';
import { sessions } from '../../db/schema';
import { CryptoService } from './crypto.service';

export interface LiveSession {
  sessionId: string;
  userId: string;
}

/** Sentinel: a Redis op failed and the caller should fall back to the DB path. */
const RedisUnavailable = Symbol('RedisUnavailable');

interface SessionMeta {
  ipHash: string | null;
  userAgent: string | null;
}

const LAST_SEEN_THROTTLE_SECONDS = 60;

/**
 * Opaque-token sessions: Redis is the fast path, the sessions table is the
 * durable record. DB is authoritative — revocation writes DB first, then
 * deletes the Redis key; a Redis flush merely degrades reads to the DB.
 */
@Injectable()
export class SessionService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly crypto: CryptoService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('SESSION_TTL_SECONDS', { infer: true });
  }

  get cookieMaxAge(): number {
    return this.ttlSeconds;
  }

  async create(userId: string, meta: SessionMeta): Promise<{ rawToken: string; sessionId: string }> {
    const rawToken = this.crypto.generateToken();
    const tokenHash = this.crypto.sha256(rawToken);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const [row] = await this.db
      .insert(sessions)
      .values({ userId, tokenHash, expiresAt, ipHash: meta.ipHash, userAgent: meta.userAgent })
      .returning({ id: sessions.id });
    if (!row) throw new Error('session insert returned no row');
    await this.redisSafe((r) =>
      r.set(this.key(tokenHash), JSON.stringify({ sessionId: row.id, userId }), 'EX', this.ttlSeconds),
    );
    return { rawToken, sessionId: row.id };
  }

  /** Validates a raw cookie token: Redis hit, or DB fallback + repopulate. */
  async validate(rawToken: string): Promise<LiveSession | null> {
    const tokenHash = this.crypto.sha256(rawToken);
    const cached = await this.redisSafe((r) => r.get(this.key(tokenHash)));
    let live: LiveSession | null =
      typeof cached === 'string' ? (JSON.parse(cached) as LiveSession) : null;

    if (!live) {
      const [row] = await this.db
        .select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, new Date()),
          ),
        );
      if (!row) return null;
      live = { sessionId: row.id, userId: row.userId };
      const remaining = Math.floor((row.expiresAt.getTime() - Date.now()) / 1000);
      if (remaining > 0) {
        await this.redisSafe((r) =>
          r.set(this.key(tokenHash), JSON.stringify(live), 'EX', remaining),
        );
      }
    }

    await this.touch(tokenHash, live.sessionId);
    return live;
  }

  /** Sliding renewal + throttled last_seen_at bookkeeping. */
  private async touch(tokenHash: string, sessionId: string): Promise<void> {
    const marker = await this.redisSafe((r) =>
      r.set(`sess:seen:${tokenHash}`, '1', 'EX', LAST_SEEN_THROTTLE_SECONDS, 'NX'),
    );
    if (marker !== 'OK' && marker !== RedisUnavailable) return;

    const [row] = await this.db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
      .returning({ expiresAt: sessions.expiresAt });
    if (!row) return;

    const remainingMs = row.expiresAt.getTime() - Date.now();
    if (remainingMs < (this.ttlSeconds * 1000) / 2) {
      const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
      await this.db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
      await this.redisSafe((r) => r.expire(this.key(tokenHash), this.ttlSeconds));
    }
  }

  async revokeByToken(rawToken: string): Promise<void> {
    const tokenHash = this.crypto.sha256(rawToken);
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
    await this.redisSafe((r) => r.del(this.key(tokenHash)));
  }

  /** Revokes one of the user's sessions by id (device list management). */
  async revokeById(userId: string, sessionId: string): Promise<boolean> {
    const [row] = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)),
      )
      .returning({ tokenHash: sessions.tokenHash });
    if (!row) return false;
    await this.redisSafe((r) => r.del(this.key(row.tokenHash)));
    return true;
  }

  /** Password change/reset, suspension, logout-all: kill every live session. */
  async revokeAllForUser(userId: string): Promise<number> {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ tokenHash: sessions.tokenHash });
    if (rows.length > 0) {
      await this.redisSafe((r) => r.del(...rows.map((row) => this.key(row.tokenHash))));
    }
    return rows.length;
  }

  async listForUser(userId: string, currentSessionId: string) {
    const rows = await this.db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt));
    return rows.map((row) => ({ ...row, current: row.id === currentSessionId }));
  }

  private key(tokenHash: string): string {
    return `sess:${tokenHash}`;
  }

  /** Redis failures degrade to the DB path instead of failing the request. */
  private async redisSafe<T>(fn: (redis: Redis) => Promise<T>): Promise<T | typeof RedisUnavailable> {
    try {
      return await fn(this.redis);
    } catch {
      return RedisUnavailable;
    }
  }
}
