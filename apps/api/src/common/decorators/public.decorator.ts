import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_METADATA = 'auth:public';

/** Opts a route out of AuthGuard/TenantGuard/PermissionGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_METADATA, true);
