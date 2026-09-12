import { Injectable } from '@nestjs/common';

import type { PermissionKey } from '@cognitest/shared';

import type { RequestContext } from '../../common/context/request-context';
import { AuthorizationService } from '../authorization.service';
import type { AuthorizationPolicy, ResourceRef } from './authorization-policy.interface';

/**
 * Explicit binary project access: project.configure holders (admin/manager)
 * see every project; everyone else needs a project_members row.
 */
@Injectable()
export class ProjectAccessPolicy implements AuthorizationPolicy {
  constructor(private readonly authz: AuthorizationService) {}

  async can(ctx: RequestContext, _action: PermissionKey, resource: ResourceRef): Promise<boolean> {
    if (!resource.projectId || !ctx.userId) return false;
    if (ctx.permissions.has('project.configure')) return true;
    return this.authz.hasProjectAccess(resource.projectId, ctx.userId);
  }
}
