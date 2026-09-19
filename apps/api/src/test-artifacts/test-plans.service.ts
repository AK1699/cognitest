import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { TestPlanStatus } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { approvals, requirements, testPlans } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';
import type { Database } from '../db/db.tokens';

const ENTITY_TYPE = 'test_plan';

/**
 * Test-plan lifecycle (spec §53–54): draft → in_review → approved; rejection
 * returns to draft; editing an approved plan bumps the version back to draft,
 * so approval always references the exact content it reviewed.
 */
@Injectable()
export class TestPlansService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string) {
    return this.tenantDb.run((tx) =>
      tx
        .select()
        .from(testPlans)
        .where(eq(testPlans.projectId, projectId))
        .orderBy(desc(testPlans.createdAt)),
    );
  }

  async create(
    projectId: string,
    organizationId: string,
    userId: string,
    input: { title: string; description?: string; requirementId?: string },
  ) {
    return this.tenantDb.run(async (tx) => {
      if (input.requirementId)
        await this.assertRequirementInProject(tx, projectId, input.requirementId);
      const [plan] = await tx
        .insert(testPlans)
        .values({ ...input, projectId, organizationId, createdBy: userId })
        .returning();
      if (!plan) throw new Error('test plan insert returned no row');
      await this.audit.log(
        { action: 'TEST_PLAN_CREATED', resourceType: 'test_plan', resourceId: plan.id },
        tx,
      );
      return plan;
    });
  }

  async get(projectId: string, testPlanId: string) {
    const [plan] = await this.tenantDb.run((tx) =>
      tx
        .select()
        .from(testPlans)
        .where(and(eq(testPlans.id, testPlanId), eq(testPlans.projectId, projectId))),
    );
    if (!plan) throw new NotFoundException();
    return plan;
  }

  async update(
    projectId: string,
    testPlanId: string,
    patch: { title?: string; description?: string | null; requirementId?: string | null },
  ) {
    return this.tenantDb.run(async (tx) => {
      const plan = await this.load(tx, projectId, testPlanId);
      if (plan.status === TestPlanStatus.InReview) {
        throw new ConflictException('Plan is awaiting a decision — it cannot be edited in review');
      }
      if (plan.status === TestPlanStatus.Archived) {
        throw new ConflictException('Archived plans cannot be edited');
      }
      if (patch.requirementId)
        await this.assertRequirementInProject(tx, projectId, patch.requirementId);

      // content changed after approval → new version needing re-approval (§54)
      const lifecycle =
        plan.status === TestPlanStatus.Approved
          ? { version: plan.version + 1, status: TestPlanStatus.Draft }
          : {};
      const [updated] = await tx
        .update(testPlans)
        .set({ ...patch, ...lifecycle })
        .where(eq(testPlans.id, testPlanId))
        .returning();
      await this.audit.log(
        {
          action: 'TEST_PLAN_UPDATED',
          resourceType: 'test_plan',
          resourceId: testPlanId,
          metadata: 'version' in lifecycle ? { versionBumpedTo: lifecycle.version } : undefined,
        },
        tx,
      );
      return updated;
    });
  }

  /** draft → in_review; (re)opens the pending approval row for this version. */
  async submit(projectId: string, testPlanId: string, userId: string) {
    return this.tenantDb.run(async (tx) => {
      const plan = await this.load(tx, projectId, testPlanId);
      if (plan.status !== TestPlanStatus.Draft) {
        throw new BadRequestException('Only draft plans can be submitted for review');
      }
      await tx
        .insert(approvals)
        .values({
          organizationId: plan.organizationId,
          entityType: ENTITY_TYPE,
          entityId: testPlanId,
          version: plan.version,
          requestedBy: userId,
        })
        .onConflictDoUpdate({
          target: [approvals.entityType, approvals.entityId, approvals.version],
          // a rejected version may be resubmitted after edits-in-draft
          set: {
            status: 'pending',
            requestedBy: userId,
            comment: null,
            decidedBy: null,
            decidedAt: null,
          },
        });
      const [updated] = await tx
        .update(testPlans)
        .set({ status: TestPlanStatus.InReview })
        .where(eq(testPlans.id, testPlanId))
        .returning();
      await this.audit.log(
        {
          action: 'TEST_PLAN_SUBMITTED',
          resourceType: 'test_plan',
          resourceId: testPlanId,
          metadata: { version: plan.version },
        },
        tx,
      );
      return updated;
    });
  }

  /** in_review → approved | draft; records the decision on the version's approval row. */
  async decide(
    projectId: string,
    testPlanId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ) {
    return this.tenantDb.run(async (tx) => {
      const plan = await this.load(tx, projectId, testPlanId);
      if (plan.status !== TestPlanStatus.InReview) {
        throw new BadRequestException('Plan is not awaiting a decision');
      }
      const updatedApprovals = await tx
        .update(approvals)
        .set({
          status: decision,
          comment: comment ?? null,
          decidedBy: userId,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(approvals.entityType, ENTITY_TYPE),
            eq(approvals.entityId, testPlanId),
            eq(approvals.version, plan.version),
            eq(approvals.status, 'pending'),
          ),
        )
        .returning({ id: approvals.id });
      if (updatedApprovals.length === 0) {
        throw new ConflictException('No pending approval for this version');
      }

      const [updated] = await tx
        .update(testPlans)
        .set({
          status: decision === 'approved' ? TestPlanStatus.Approved : TestPlanStatus.Draft,
        })
        .where(eq(testPlans.id, testPlanId))
        .returning();
      await this.audit.log(
        {
          action: decision === 'approved' ? 'TEST_PLAN_APPROVED' : 'TEST_PLAN_REJECTED',
          resourceType: 'test_plan',
          resourceId: testPlanId,
          metadata: { version: plan.version, comment: comment ?? null },
        },
        tx,
      );
      return updated;
    });
  }

  async listApprovals(projectId: string, testPlanId: string) {
    return this.tenantDb.run(async (tx) => {
      await this.load(tx, projectId, testPlanId);
      return tx
        .select()
        .from(approvals)
        .where(and(eq(approvals.entityType, ENTITY_TYPE), eq(approvals.entityId, testPlanId)))
        .orderBy(desc(approvals.version));
    });
  }

  /** Soft delete per spec §69 — the plan and its suites/cases are preserved. */
  async archive(projectId: string, testPlanId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      await this.load(tx, projectId, testPlanId);
      await tx
        .update(testPlans)
        .set({ status: TestPlanStatus.Archived })
        .where(eq(testPlans.id, testPlanId));
      await this.audit.log(
        { action: 'TEST_PLAN_ARCHIVED', resourceType: 'test_plan', resourceId: testPlanId },
        tx,
      );
    });
  }

  private async load(tx: Database, projectId: string, testPlanId: string) {
    const [plan] = await tx
      .select()
      .from(testPlans)
      .where(and(eq(testPlans.id, testPlanId), eq(testPlans.projectId, projectId)));
    if (!plan) throw new NotFoundException();
    return plan;
  }

  private async assertRequirementInProject(
    tx: Database,
    projectId: string,
    requirementId: string,
  ): Promise<void> {
    const [requirement] = await tx
      .select({ id: requirements.id })
      .from(requirements)
      .where(and(eq(requirements.id, requirementId), eq(requirements.projectId, projectId)));
    if (!requirement) throw new BadRequestException('Requirement does not belong to this project');
  }
}
