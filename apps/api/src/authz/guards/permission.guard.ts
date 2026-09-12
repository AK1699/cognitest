import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { PermissionKey } from '@cognitest/shared';

import { RequestContextService } from '../../common/context/request-context.service';
import { AuthorizationService } from '../authorization.service';
import { PERMISSIONS_METADATA } from '../decorators/require-permission.decorator';

/**
 * Enforces @RequirePermission declarations against the member's role. Routes
 * without the decorator pass — the route-coverage spec guarantees no tenant
 * route ships without one.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
    private readonly ctx: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const store = this.ctx.getOrThrow();
    const roleId = store.roleIds[0];
    if (!store.organizationId || !roleId) {
      // @RequirePermission outside tenant context is a programming error
      throw new ForbiddenException('Permission check requires organization context');
    }

    const granted = await this.authz.getRolePermissions(roleId);
    this.ctx.patch({ permissions: granted });

    const missing = required.filter((key) => !granted.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
