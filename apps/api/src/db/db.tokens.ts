import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type * as schema from './schema';

export const PG_CLIENT = Symbol('PG_CLIENT');
export const DRIZZLE = Symbol('DRIZZLE');

export type Database = PostgresJsDatabase<typeof schema>;
