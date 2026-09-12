import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { RequestContextService } from '../../common/context/request-context.service';
import { ProjectAccessPolicy } from '../policies/project-access.policy';

/**
 * Per-controller guard for routes with a :projectId param. Runs after the
 * global chain, so tenant context and permissions are already established.
 * Fails with 404 — a project the user cannot access does not exist for them.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly policy: ProjectAccessPolicy,
    private readonly ctx: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const projectId = (request.params as Record<string, string> | undefined)?.projectId;
    if (!projectId) return true;

    const store = this.ctx.getOrThrow();
    if (!store.organizationId) throw new NotFoundException();

    const allowed = await this.policy.can(store, 'project.read', {
      organizationId: store.organizationId,
      projectId,
    });
    if (!allowed) throw new NotFoundException();
    return true;
  }
}
