import { pgSchema } from 'drizzle-orm/pg-core';

// Domain namespaces. Enums and the app_* helper functions stay in public;
// the database default search_path includes all of these (set in migration
// 0010) so ad-hoc/unqualified SQL keeps resolving.

/** Who you are: users, credentials, sessions. */
export const identitySchema = pgSchema('identity');
/** Tenant boundaries: organizations, teams, membership, invitations. */
export const tenancySchema = pgSchema('tenancy');
/** What you may do: roles and permissions. */
export const accessSchema = pgSchema('access');
/** The product domain: projects (later test plans, cases, executions). */
export const productSchema = pgSchema('product');
/** The immutable security trail. */
export const auditSchema = pgSchema('audit');
