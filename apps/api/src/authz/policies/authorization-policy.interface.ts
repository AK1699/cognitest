import type { PermissionKey } from '@cognitest/shared';

import type { RequestContext } from '../../common/context/request-context';

export interface ResourceRef {
  organizationId: string;
  projectId?: string;
  resourceId?: string;
}

/**
 * Resource-level authorization beyond RBAC (spec §65) — e.g. "does this user
 * have access to this specific project". Implementations are Nest providers
 * consumed by guards.
 */
export interface AuthorizationPolicy {
  can(ctx: RequestContext, action: PermissionKey, resource: ResourceRef): Promise<boolean>;
}
