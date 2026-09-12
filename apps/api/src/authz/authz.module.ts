import { Global, Module } from '@nestjs/common';

import { AuthorizationService } from './authorization.service';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { PermissionGuard } from './guards/permission.guard';
import { TenantGuard } from './guards/tenant.guard';
import { ProjectAccessPolicy } from './policies/project-access.policy';

@Global()
@Module({
  providers: [
    AuthorizationService,
    TenantGuard,
    PermissionGuard,
    ProjectAccessGuard,
    ProjectAccessPolicy,
  ],
  exports: [AuthorizationService, TenantGuard, PermissionGuard, ProjectAccessGuard],
})
export class AuthzModule {}
