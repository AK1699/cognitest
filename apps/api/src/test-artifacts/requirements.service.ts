import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import type { RequirementStatus } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { requirements } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class RequirementsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string) {
    return this.tenantDb.run((tx) =>
      tx
        .select()
        .from(requirements)
        .where(eq(requirements.projectId, projectId))
        .orderBy(desc(requirements.createdAt)),
    );
  }

  async create(
    projectId: string,
    organizationId: string,
    userId: string,
    input: { title: string; description?: string },
  ) {
    return this.tenantDb.run(async (tx) => {
      const [requirement] = await tx
        .insert(requirements)
        .values({ ...input, projectId, organizationId, createdBy: userId })
        .returning();
      if (!requirement) throw new Error('requirement insert returned no row');
      await this.audit.log(
        { action: 'REQUIREMENT_CREATED', resourceType: 'requirement', resourceId: requirement.id },
        tx,
      );
      return requirement;
    });
  }

  async get(projectId: string, requirementId: string) {
    const [requirement] = await this.tenantDb.run((tx) =>
      tx
        .select()
        .from(requirements)
        .where(and(eq(requirements.id, requirementId), eq(requirements.projectId, projectId))),
    );
    if (!requirement) throw new NotFoundException();
    return requirement;
  }

  async update(
    projectId: string,
    requirementId: string,
    patch: { title?: string; description?: string | null; status?: RequirementStatus },
  ) {
    return this.tenantDb.run(async (tx) => {
      const [requirement] = await tx
        .update(requirements)
        .set(patch)
        .where(and(eq(requirements.id, requirementId), eq(requirements.projectId, projectId)))
        .returning();
      if (!requirement) throw new NotFoundException();
      await this.audit.log(
        { action: 'REQUIREMENT_UPDATED', resourceType: 'requirement', resourceId: requirementId },
        tx,
      );
      return requirement;
    });
  }

  async remove(projectId: string, requirementId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const deleted = await tx
        .delete(requirements)
        .where(and(eq(requirements.id, requirementId), eq(requirements.projectId, projectId)))
        .returning({ id: requirements.id });
      if (deleted.length === 0) throw new NotFoundException();
      await this.audit.log(
        { action: 'REQUIREMENT_DELETED', resourceType: 'requirement', resourceId: requirementId },
        tx,
      );
    });
  }
}
