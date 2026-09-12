import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { loadEnv } from '../config/load-env';

/**
 * Applies all pending migrations from apps/api/drizzle/. Idempotent — already
 * applied migrations are recorded in drizzle.__drizzle_migrations and skipped.
 */
export async function runMigrations(): Promise<void> {
  loadEnv();
  // migrations run as the table owner (RLS bypass is intentional here);
  // the API runtime uses the non-owner cognitest_app role via DATABASE_URL
  const url =
    process.env.DATABASE_URL_MIGRATIONS ??
    process.env.DATABASE_URL ??
    'postgres://cognitest:cognitest@localhost:5432/cognitest';
  // max: 1 — the migrator needs a single connection, and anything more keeps
  // the process alive after end()
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: resolve(__dirname, '../../drizzle') });
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => console.log('migrations applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
