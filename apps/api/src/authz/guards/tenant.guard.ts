import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { MemberStatus } from '@cognitest/shared';

import { RequestContextService } from '../../common/context/request-context.service';
import { IS_PUBLIC_METADATA } from '../../common/decorators/public.decorator';
import { AuthorizationService } from '../authorization.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Establishes tenant context from the :organizationId path param, validated
 * against membership — the client's claim is never trusted (spec §33).
 * Non-members and suspended members get 404, not 403: the organization's
 * existence is not disclosed (spec §66).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
    private readonly ctx: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_METADATA, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const organizationId = (request.params as Record<string, string> | undefined)?.organizationId;
    if (!organizationId) return true; // non-tenant route — nothing to establish

    const userId = request.user?.id;
    if (!userId || !UUID_RE.test(organizationId)) throw new NotFoundException();

    const membership = await this.authz.getMembership(organizationId, userId);
    if (!membership || membership.status !== MemberStatus.Active || !membership.roleId) {
      throw new NotFoundException();
    }

    this.ctx.patch({
      organizationId,
      membershipId: membership.membershipId,
      roleIds: [membership.roleId],
    });
    const teamIds = await this.authz.getTeamIds(organizationId, userId);
    this.ctx.patch({ teamIds });
    return true;
  }
}
