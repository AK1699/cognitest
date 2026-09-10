import { defineConfig } from 'drizzle-kit';

import { loadEnv } from './src/config/load-env';

loadEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cognitest:cognitest@localhost:5432/cognitest',
  },
});
