import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import type { TestCasePriority, TestStep } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { testCases, testPlans, testSuites } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';
import type { Database } from '../db/db.tokens';

/** Suites and cases — always resolved through their plan → project chain (spec §30). */
@Injectable()
export class TestCasesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------- suites ----

  async listSuites(projectId: string, testPlanId: string) {
    return this.tenantDb.run(async (tx) => {
      await this.assertPlanInProject(tx, projectId, testPlanId);
      return tx
        .select()
        .from(testSuites)
        .where(eq(testSuites.testPlanId, testPlanId))
        .orderBy(asc(testSuites.position), asc(testSuites.createdAt));
    });
  }

  async createSuite(
    projectId: string,
    organizationId: string,
    testPlanId: string,
    input: { title: string; description?: string; position?: number },
  ) {
    return this.tenantDb.run(async (tx) => {
      await this.assertPlanInProject(tx, projectId, testPlanId);
      const [suite] = await tx
        .insert(testSuites)
        .values({ ...input, testPlanId, organizationId })
        .returning();
      if (!suite) throw new Error('test suite insert returned no row');
      await this.audit.log(
        { action: 'TEST_SUITE_CREATED', resourceType: 'test_suite', resourceId: suite.id },
        tx,
      );
      return suite;
    });
  }

  async updateSuite(
    projectId: string,
    suiteId: string,
    patch: { title?: string; description?: string | null; position?: number },
  ) {
    return this.tenantDb.run(async (tx) => {
      await this.assertSuiteInProject(tx, projectId, suiteId);
      const [suite] = await tx
        .update(testSuites)
        .set(patch)
        .where(eq(testSuites.id, suiteId))
        .returning();
      await this.audit.log(
        { action: 'TEST_SUITE_UPDATED', resourceType: 'test_suite', resourceId: suiteId },
        tx,
      );
      return suite;
    });
  }

  async removeSuite(projectId: string, suiteId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      await this.assertSuiteInProject(tx, projectId, suiteId);
      await tx.delete(testSuites).where(eq(testSuites.id, suiteId));
      await this.audit.log(
        { action: 'TEST_SUITE_DELETED', resourceType: 'test_suite', resourceId: suiteId },
        tx,
      );
    });
  }

  // --------------------------------------------------------------- cases ----

  async listCases(projectId: string, suiteId: string) {
    return this.tenantDb.run(async (tx) => {
      await this.assertSuiteInProject(tx, projectId, suiteId);
      return tx
        .select()
        .from(testCases)
        .where(eq(testCases.testSuiteId, suiteId))
        .orderBy(asc(testCases.position), asc(testCases.createdAt));
    });
  }

  async createCase(
    projectId: string,
    organizationId: string,
    suiteId: string,
    userId: string,
    input: {
      title: string;
      description?: string;
      steps?: TestStep[];
      priority?: TestCasePriority;
      position?: number;
    },
  ) {
    return this.tenantDb.run(async (tx) => {
      await this.assertSuiteInProject(tx, projectId, suiteId);
      const [testCase] = await tx
        .insert(testCases)
        .values({ ...input, testSuiteId: suiteId, organizationId, createdBy: userId })
        .returning();
      if (!testCase) throw new Error('test case insert returned no row');
      await this.audit.log(
        { action: 'TEST_CASE_CREATED', resourceType: 'test_case', resourceId: testCase.id },
        tx,
      );
      return testCase;
    });
  }

  async updateCase(
    projectId: string,
    caseId: string,
    patch: {
      title?: string;
      description?: string | null;
      steps?: TestStep[];
      priority?: TestCasePriority;
      position?: number;
    },
  ) {
    return this.tenantDb.run(async (tx) => {
      await this.assertCaseInProject(tx, projectId, caseId);
      const [testCase] = await tx
        .update(testCases)
        .set(patch)
        .where(eq(testCases.id, caseId))
        .returning();
      await this.audit.log(
        { action: 'TEST_CASE_UPDATED', resourceType: 'test_case', resourceId: caseId },
        tx,
      );
      return testCase;
    });
  }

  async removeCase(projectId: string, caseId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      await this.assertCaseInProject(tx, projectId, caseId);
      await tx.delete(testCases).where(eq(testCases.id, caseId));
      await this.audit.log(
        { action: 'TEST_CASE_DELETED', resourceType: 'test_case', resourceId: caseId },
        tx,
      );
    });
  }

  // ------------------------------------------------------ chain asserts -----

  private async assertPlanInProject(tx: Database, projectId: string, testPlanId: string) {
    const [plan] = await tx
      .select({ id: testPlans.id })
      .from(testPlans)
      .where(and(eq(testPlans.id, testPlanId), eq(testPlans.projectId, projectId)));
    if (!plan) throw new NotFoundException();
  }

  private async assertSuiteInProject(tx: Database, projectId: string, suiteId: string) {
    const [suite] = await tx
      .select({ id: testSuites.id })
      .from(testSuites)
      .innerJoin(testPlans, eq(testPlans.id, testSuites.testPlanId))
      .where(and(eq(testSuites.id, suiteId), eq(testPlans.projectId, projectId)));
    if (!suite) throw new NotFoundException();
  }

  private async assertCaseInProject(tx: Database, projectId: string, caseId: string) {
    const [row] = await tx
      .select({ id: testCases.id })
      .from(testCases)
      .innerJoin(testSuites, eq(testSuites.id, testCases.testSuiteId))
      .innerJoin(testPlans, eq(testPlans.id, testSuites.testPlanId))
      .where(and(eq(testCases.id, caseId), eq(testPlans.projectId, projectId)));
    if (!row) throw new NotFoundException();
  }
}
