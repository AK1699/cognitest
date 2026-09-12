import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authz/authorization.service';
import { RequestContextService } from '../common/context/request-context.service';
import { isUniqueViolation } from '../common/db-errors';
import { organizationMembers, projectMembers, projects } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
    private readonly ctx: RequestContextService,
  ) {}

  /** Admins/managers (project.configure) see all projects; others only theirs. */
  async list(organizationId: string, userId: string) {
    const store = this.ctx.getOrThrow();
    const roleId = store.roleIds[0];
    const canSeeAll = roleId
      ? (await this.authz.getRolePermissions(roleId)).has('project.configure')
      : false;

    return this.tenantDb.run(async (tx) => {
      if (canSeeAll) {
        return tx.select().from(projects).where(eq(projects.organizationId, organizationId));
      }
      const memberships = await tx
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, userId));
      const ids = memberships.map((m) => m.projectId);
      if (ids.length === 0) return [];
      return tx.select().from(projects).where(inArray(projects.id, ids));
    });
  }

  async create(
    organizationId: string,
    userId: string,
    input: { key: string; name: string; description?: string },
  ) {
    return this.tenantDb.run(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          organizationId,
          key: input.key,
          name: input.name,
          description: input.description,
          createdBy: userId,
        })
        .returning()
        .catch((error: unknown) => {
          throw isUniqueViolation(error, 'projects_org_key_uq')
            ? new ConflictException('A project with that key already exists')
            : error;
        });
      if (!project) throw new Error('project insert returned no row');
      await tx.insert(projectMembers).values({ projectId: project.id, organizationId, userId });
      await this.audit.log(
        { action: 'PROJECT_CREATED', resourceType: 'project', resourceId: project.id },
        tx,
      );
      return project;
    });
  }

  async get(projectId: string) {
    const [project] = await this.tenantDb.run((tx) =>
      tx.select().from(projects).where(eq(projects.id, projectId)),
    );
    if (!project) throw new NotFoundException();
    return project;
  }

  async update(
    projectId: string,
    patch: { name?: string; description?: string | null; status?: 'active' | 'archived' },
  ) {
    return this.tenantDb.run(async (tx) => {
      const [project] = await tx
        .update(projects)
        .set(patch)
        .where(eq(projects.id, projectId))
        .returning();
      if (!project) throw new NotFoundException();
      await this.audit.log(
        {
          action: patch.status === 'archived' ? 'PROJECT_ARCHIVED' : 'PROJECT_UPDATED',
          resourceType: 'project',
          resourceId: projectId,
        },
        tx,
      );
      return project;
    });
  }

  async archive(projectId: string): Promise<void> {
    await this.update(projectId, { status: 'archived' });
  }

  async listMembers(projectId: string) {
    return this.tenantDb.run((tx) =>
      tx.select().from(projectMembers).where(eq(projectMembers.projectId, projectId)),
    );
  }

  async addMember(organizationId: string, projectId: string, userId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [member] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, userId),
          ),
        );
      if (!member) throw new BadRequestException('User is not a member of this organization');
      await tx
        .insert(projectMembers)
        .values({ projectId, organizationId, userId })
        .onConflictDoNothing();
      await this.audit.log(
        {
          action: 'PROJECT_MEMBER_ADDED',
          resourceType: 'project',
          resourceId: projectId,
          metadata: { userId },
        },
        tx,
      );
      await this.authz.invalidateProjectAccess(projectId, userId);
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const deleted = await tx
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
        .returning({ id: projectMembers.id });
      if (deleted.length === 0) throw new NotFoundException();
      await this.audit.log(
        {
          action: 'PROJECT_MEMBER_REMOVED',
          resourceType: 'project',
          resourceId: projectId,
          metadata: { userId },
        },
        tx,
      );
      await this.authz.invalidateProjectAccess(projectId, userId);
    });
  }
}
