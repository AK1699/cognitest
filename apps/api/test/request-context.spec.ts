import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { RequestContextService } from '../src/common/context/request-context.service';
import { loadEnv } from '../src/config/load-env';
import { TenantDb } from '../src/db/tenant-db.service';
import type { Database } from '../src/db/db.tokens';

loadEnv();
const url = process.env.DATABASE_URL ?? 'postgres://cognitest:cognitest@localhost:5432/cognitest';
const client = postgres(url, { max: 2 });
const db = drizzle(client) as unknown as Database;

const ORG_A = '11111111-1111-1111-1111-111111111111';
const USER_A = '22222222-2222-2222-2222-222222222222';

afterAll(async () => {
  await client.end();
});

describe('RequestContextService', () => {
  const ctx = new RequestContextService();

  it('provides the store inside run() and nothing outside', () => {
    expect(ctx.get()).toBeUndefined();
    expect(() => ctx.getOrThrow()).toThrow(/No request context/);

    ctx.run({ userId: USER_A }, () => {
      expect(ctx.getOrThrow().userId).toBe(USER_A);
      expect(ctx.getOrThrow().permissions.size).toBe(0);
    });
    expect(ctx.get()).toBeUndefined();
  });

  it('patch enriches the active store; nested runs are isolated', () => {
    ctx.run({ userId: USER_A }, () => {
      ctx.patch({ organizationId: ORG_A, roleIds: ['r1'] });
      expect(ctx.getOrThrow().organizationId).toBe(ORG_A);

      ctx.run({ userId: 'other' }, () => {
        expect(ctx.getOrThrow().organizationId).toBeUndefined();
      });
      expect(ctx.getOrThrow().userId).toBe(USER_A);
    });
  });

  it('survives async boundaries', async () => {
    await ctx.run({ jobId: 'job-1' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(ctx.getOrThrow().jobId).toBe('job-1');
    });
  });
});

describe('TenantDb', () => {
  const ctx = new RequestContextService();
  const tenantDb = new TenantDb(db, ctx);

  it('applies tenant GUCs inside the transaction only', async () => {
    const inside = await ctx.run({ organizationId: ORG_A, userId: USER_A }, () =>
      tenantDb.run(async (tx) => {
        const rows = await tx.execute(sql`
          select current_setting('app.organization_id', true) as org,
                 current_setting('app.user_id', true) as usr`);
        return rows[0] as { org: string; usr: string };
      }),
    );
    expect(inside.org).toBe(ORG_A);
    expect(inside.usr).toBe(USER_A);

    // SET LOCAL is transaction-scoped: a fresh statement sees no tenant
    const outside = await client`select current_setting('app.organization_id', true) as org`;
    expect(outside[0]?.org ?? '').toBe('');
  });

  it('refuses to run without organization context', async () => {
    await expect(
      ctx.run({ userId: USER_A }, () => tenantDb.run(async () => 'unreachable')),
    ).rejects.toThrow(/requires organizationId/);
    await expect(tenantDb.run(async () => 'unreachable')).rejects.toThrow(/No request context/);
  });

  it('runAsUser sets only app.user_id', async () => {
    const row = await tenantDb.runAsUser(USER_A, async (tx) => {
      const rows = await tx.execute(sql`
        select current_setting('app.organization_id', true) as org,
               current_setting('app.user_id', true) as usr`);
      return rows[0] as { org: string; usr: string };
    });
    expect(row.org).toBe('');
    expect(row.usr).toBe(USER_A);
  });
});
