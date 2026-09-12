import { SetMetadata } from '@nestjs/common';

import type { PermissionKey } from '@cognitest/shared';

export const PERMISSIONS_METADATA = 'authz:permissions';

/**
 * Declares the permissions a route requires (spec §64). PermissionGuard makes
 * the decision; the route-coverage spec enforces that every tenant route
 * carries this or @Public().
 */
export const RequirePermission = (...keys: [PermissionKey, ...PermissionKey[]]) =>
  SetMetadata(PERMISSIONS_METADATA, keys);
