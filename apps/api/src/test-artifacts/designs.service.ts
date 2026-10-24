import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';

import { DesignStatus } from '@cognitest/shared';
import type { DesignSource } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import {
  approvals,
  requirements,
  testCases,
  testDesigns,
  testPlans,
  testSuites,
} from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';
import type { Database } from '../db/db.tokens';

const ENTITY_TYPE = 'test_design';

type DesignRow = typeof testDesigns.$inferSelect;

interface GeneratedStep {
  action: string;
  expected?: string;
}
interface ParsedScenario {
  title: string;
  steps: GeneratedStep[];
}

/** Pulls the body of every fenced ```gherkin block out of a Markdown string. */
function extractGherkinBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const fence = /```gherkin\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(markdown ?? ''))) blocks.push(match[1] ?? '');
  return blocks;
}

/**
 * Parses Gherkin into scenarios + steps. Each Scenario/Scenario Outline becomes a
 * case; Given/When/And/But lines are step actions, and a Then attaches as the
 * `expected` of the preceding step (or its own step when there's none).
 */
function parseScenarios(gherkin: string): ParsedScenario[] {
  const scenarios: ParsedScenario[] = [];
  let current: ParsedScenario | null = null;
  for (const rawLine of gherkin.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = /^(Scenario Outline|Scenario):\s*(.*)$/i.exec(line);
    if (header) {
      current = { title: header[2]?.trim() || 'Scenario', steps: [] };
      scenarios.push(current);
      continue;
    }
    const step = /^(Given|When|Then|And|But)\b\s*(.*)$/i.exec(line);
    if (step && current) {
      const keyword = step[1] ?? '';
      const text = (step[2] ?? '').trim();
      const last = current.steps[current.steps.length - 1];
      if (/^then$/i.test(keyword) && last && last.expected === undefined) {
        last.expected = text || keyword;
      } else {
        current.steps.push({ action: `${keyword} ${text}`.trim() });
      }
    }
  }
  return scenarios;
}

/**
 * Test-design lifecycle mirrors test plans (spec §53–54): draft → in_review →
 * approved; rejection returns to draft; editing an approved design bumps the
 * version back to draft so approval always references the content it reviewed.
 */
@Injectable()
export class DesignsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(projectId: string) {
    return this.tenantDb.run(async (tx) => {
      const designs = await tx
        .select()
        .from(testDesigns)
        .where(eq(testDesigns.projectId, projectId))
        .orderBy(desc(testDesigns.createdAt));
      return Promise.all(designs.map((design) => this.withCounts(tx, design)));
    });
  }

  async create(
    projectId: string,
    organizationId: string,
    userId: string,
    input: { name: string; description?: string; source?: DesignSource },
  ) {
    return this.tenantDb.run(async (tx) => {
      const [design] = await tx
        .insert(testDesigns)
        .values({ ...input, projectId, organizationId, createdBy: userId })
        .returning();
      if (!design) throw new Error('test design insert returned no row');
      await this.audit.log(
        { action: 'TEST_DESIGN_CREATED', resourceType: ENTITY_TYPE, resourceId: design.id },
        tx,
      );
      return this.withCounts(tx, design);
    });
  }

  async getSummary(projectId: string, designId: string) {
    return this.tenantDb.run(async (tx) => {
      const design = await this.load(tx, projectId, designId);
      return this.withCounts(tx, design);
    });
  }

  async update(
    projectId: string,
    designId: string,
    patch: { name?: string; description?: string | null },
  ) {
    return this.tenantDb.run(async (tx) => {
      const design = await this.load(tx, projectId, designId);
      if (design.status === DesignStatus.InReview) {
        throw new ConflictException('Design is awaiting a decision — it cannot be edited in review');
      }
      if (design.status === DesignStatus.Archived) {
        throw new ConflictException('Archived designs cannot be edited');
      }
      // editing an approved design starts a new version needing re-approval (§54)
      const lifecycle =
        design.status === DesignStatus.Approved
          ? { version: design.version + 1, status: DesignStatus.Draft }
          : {};
      const [updated] = await tx
        .update(testDesigns)
        .set({ ...patch, ...lifecycle })
        .where(eq(testDesigns.id, designId))
        .returning();
      await this.audit.log(
        {
          action: 'TEST_DESIGN_UPDATED',
          resourceType: ENTITY_TYPE,
          resourceId: designId,
          metadata: 'version' in lifecycle ? { versionBumpedTo: lifecycle.version } : undefined,
        },
        tx,
      );
      return this.withCounts(tx, updated!);
    });
  }

  /** draft → in_review; (re)opens the pending approval row for this version. */
  async submit(projectId: string, designId: string, userId: string) {
    return this.tenantDb.run(async (tx) => {
      const design = await this.load(tx, projectId, designId);
      if (design.status !== DesignStatus.Draft) {
        throw new BadRequestException('Only draft designs can be submitted for review');
      }
      await tx
        .insert(approvals)
        .values({
          organizationId: design.organizationId,
          entityType: ENTITY_TYPE,
          entityId: designId,
          version: design.version,
          requestedBy: userId,
        })
        .onConflictDoUpdate({
          target: [approvals.entityType, approvals.entityId, approvals.version],
          set: {
            status: 'pending',
            requestedBy: userId,
            comment: null,
            decidedBy: null,
            decidedAt: null,
          },
        });
      const [updated] = await tx
        .update(testDesigns)
        .set({ status: DesignStatus.InReview })
        .where(eq(testDesigns.id, designId))
        .returning();
      await this.audit.log(
        {
          action: 'TEST_DESIGN_SUBMITTED',
          resourceType: ENTITY_TYPE,
          resourceId: designId,
          metadata: { version: design.version },
        },
        tx,
      );
      return this.withCounts(tx, updated!);
    });
  }

  /** in_review → approved | draft; records the decision on the version's row. */
  async decide(
    projectId: string,
    designId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ) {
    return this.tenantDb.run(async (tx) => {
      const design = await this.load(tx, projectId, designId);
      if (design.status !== DesignStatus.InReview) {
        throw new BadRequestException('Design is not awaiting a decision');
      }
      const decided = await tx
        .update(approvals)
        .set({ status: decision, comment: comment ?? null, decidedBy: userId, decidedAt: new Date() })
        .where(
          and(
            eq(approvals.entityType, ENTITY_TYPE),
            eq(approvals.entityId, designId),
            eq(approvals.version, design.version),
            eq(approvals.status, 'pending'),
          ),
        )
        .returning({ id: approvals.id });
      if (decided.length === 0) {
        throw new ConflictException('No pending approval for this version');
      }
      const [updated] = await tx
        .update(testDesigns)
        .set({ status: decision === 'approved' ? DesignStatus.Approved : DesignStatus.Draft })
        .where(eq(testDesigns.id, designId))
        .returning();
      await this.audit.log(
        {
          action: decision === 'approved' ? 'TEST_DESIGN_APPROVED' : 'TEST_DESIGN_REJECTED',
          resourceType: ENTITY_TYPE,
          resourceId: designId,
          metadata: { version: design.version, comment: comment ?? null },
        },
        tx,
      );
      return this.withCounts(tx, updated!);
    });
  }

  async listApprovals(projectId: string, designId: string) {
    return this.tenantDb.run(async (tx) => {
      await this.load(tx, projectId, designId);
      return tx
        .select()
        .from(approvals)
        .where(and(eq(approvals.entityType, ENTITY_TYPE), eq(approvals.entityId, designId)))
        .orderBy(desc(approvals.version));
    });
  }

  /**
   * Hard delete — removes the design and (via composite-FK cascades) its
   * requirements, plans, suites and cases, plus its approval rows.
   */
  async remove(projectId: string, designId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      await this.load(tx, projectId, designId); // 404 if it isn't in this project
      await tx
        .delete(approvals)
        .where(and(eq(approvals.entityType, ENTITY_TYPE), eq(approvals.entityId, designId)));
      await tx.delete(testDesigns).where(eq(testDesigns.id, designId));
      await this.audit.log(
        { action: 'TEST_DESIGN_DELETED', resourceType: ENTITY_TYPE, resourceId: designId },
        tx,
      );
    });
  }

  /**
   * Generates test artefacts from an approved design: one test plan, a suite per
   * requirement, and a case per Gherkin scenario (Given/When/Then → steps).
   * Requirements without Gherkin get one placeholder case. Non-destructive — it
   * creates a new plan each run rather than touching existing ones.
   */
  async generateArtifacts(
    projectId: string,
    organizationId: string,
    userId: string,
    designId: string,
  ) {
    return this.tenantDb.run(async (tx) => {
      const design = await this.load(tx, projectId, designId);
      if (design.status !== DesignStatus.Approved) {
        throw new BadRequestException('Approve the design before generating test artefacts');
      }
      const reqs = await tx
        .select()
        .from(requirements)
        .where(eq(requirements.designId, designId))
        .orderBy(requirements.createdAt);
      if (reqs.length === 0) {
        throw new BadRequestException('Add requirements before generating test artefacts');
      }

      const [plan] = await tx
        .insert(testPlans)
        .values({
          projectId,
          organizationId,
          designId,
          createdBy: userId,
          title: `${design.name} — Test Plan`,
          description: design.description ?? null,
        })
        .returning();
      if (!plan) throw new Error('test plan insert returned no row');

      let suiteCount = 0;
      let caseCount = 0;
      let suitePosition = 0;
      for (const req of reqs) {
        const [suite] = await tx
          .insert(testSuites)
          .values({
            organizationId,
            testPlanId: plan.id,
            title: req.title,
            position: suitePosition++,
          })
          .returning();
        if (!suite) continue;
        suiteCount += 1;

        const scenarios = extractGherkinBlocks(req.description ?? '').flatMap(parseScenarios);
        const cases: ParsedScenario[] = scenarios.length
          ? scenarios
          : [{ title: req.title, steps: [] }];
        let casePosition = 0;
        for (const testCase of cases) {
          await tx.insert(testCases).values({
            organizationId,
            testSuiteId: suite.id,
            createdBy: userId,
            title: testCase.title,
            steps: testCase.steps,
            position: casePosition++,
          });
          caseCount += 1;
        }
      }

      await this.audit.log(
        {
          action: 'TEST_PLAN_CREATED',
          resourceType: 'test_plan',
          resourceId: plan.id,
          metadata: { generatedFromDesign: designId, suiteCount, caseCount },
        },
        tx,
      );
      return { testPlan: plan, suiteCount, caseCount };
    });
  }

  /** Confirms a design exists in the project; used before nesting child routes. */
  async assertInProject(projectId: string, designId: string): Promise<void> {
    await this.tenantDb.run((tx) => this.load(tx, projectId, designId));
  }

  private async load(tx: Database, projectId: string, designId: string): Promise<DesignRow> {
    const [design] = await tx
      .select()
      .from(testDesigns)
      .where(and(eq(testDesigns.id, designId), eq(testDesigns.projectId, projectId)));
    if (!design) throw new NotFoundException();
    return design;
  }

  private async withCounts(tx: Database, design: DesignRow) {
    const [reqs] = await tx
      .select({ n: count() })
      .from(requirements)
      .where(eq(requirements.designId, design.id));
    const [suites] = await tx
      .select({ n: count() })
      .from(testSuites)
      .innerJoin(testPlans, eq(testSuites.testPlanId, testPlans.id))
      .where(eq(testPlans.designId, design.id));
    const [cases] = await tx
      .select({ n: count() })
      .from(testCases)
      .innerJoin(testSuites, eq(testCases.testSuiteId, testSuites.id))
      .innerJoin(testPlans, eq(testSuites.testPlanId, testPlans.id))
      .where(eq(testPlans.designId, design.id));
    return {
      ...design,
      requirementCount: reqs?.n ?? 0,
      suiteCount: suites?.n ?? 0,
      caseCount: cases?.n ?? 0,
    };
  }
}
