import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';

import type { HealthCheckState, HealthResponse } from '@cognitest/shared';

import { DRIZZLE } from '../db/db.module';
import type { Database } from '../db/db.module';
import { REDIS } from '../redis/redis.module';

const CHECK_TIMEOUT_MS = 2_000;

function withTimeout(check: Promise<unknown>): Promise<unknown> {
  return Promise.race([
    check,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('health check timed out')), CHECK_TIMEOUT_MS);
      timer.unref();
    }),
  ]);
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResponse> {
    const [postgres, redis] = await Promise.allSettled([
      withTimeout(this.db.execute(sql`select 1`)),
      withTimeout(this.redis.ping()),
    ]);

    const state = (result: PromiseSettledResult<unknown>): HealthCheckState =>
      result.status === 'fulfilled' ? 'up' : 'down';

    const checks = { postgres: state(postgres), redis: state(redis) };
    return {
      status: checks.postgres === 'up' && checks.redis === 'up' ? 'ok' : 'degraded',
      checks,
    };
  }
}
