import type { PermissionKey } from '@cognitest/shared';

/**
 * Per-request (or per-job) context carried on AsyncLocalStorage (spec §34).
 * Seeded empty by the middleware, enriched by AuthGuard (user/session),
 * TenantGuard (org/membership/teams) and PermissionGuard (permissions);
 * consumed by TenantDb (RLS GUCs) and AuditService.
 */
export interface RequestContext {
  userId?: string;
  sessionId?: string;
  organizationId?: string;
  membershipId?: string;
  roleIds: string[];
  teamIds: string[];
  permissions: Set<PermissionKey>;
  /** Present on HTTP requests; absent for background jobs. */
  ip?: string;
  userAgent?: string;
  jobId?: string;
}

export function emptyRequestContext(seed: Partial<RequestContext> = {}): RequestContext {
  return { roleIds: [], teamIds: [], permissions: new Set(), ...seed };
}
