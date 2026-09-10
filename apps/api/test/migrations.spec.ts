import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/load-env';
import { runMigrations } from '../src/db/migrate';

loadEnv();
const url = process.env.DATABASE_URL ?? 'postgres://cognitest:cognitest@localhost:5432/cognitest';

async function appliedMigrationCount(): Promise<number> {
  const client = postgres(url, { max: 1 });
  try {
    const rows = await client`select count(*)::int as count from drizzle.__drizzle_migrations`;
    return rows[0]?.count as number;
  } finally {
    await client.end();
  }
}

describe('migrations', () => {
  it('apply cleanly and are idempotent', async () => {
    await runMigrations();
    const applied = await appliedMigrationCount();
    expect(applied).toBeGreaterThanOrEqual(3);

    // second run must be a no-op, not an error
    await expect(runMigrations()).resolves.not.toThrow();
    expect(await appliedMigrationCount()).toBe(applied);
  });
});
