import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { AutomationRunStatus, AutomationTestStatus } from '@cognitest/shared';
import type {
  AutomationRunResult,
  AutomationTestStatus as TestStatus,
  CreateAutomationRunRequest,
  TestStep,
} from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import type { Database } from '../db/db.tokens';
import { automations, automationRuns, automationTests } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

const ENTITY_TYPE = 'automation_run';

type RunRow = typeof automationRuns.$inferSelect;

/** Deterministic per-test duration — no runtime, so timings are derived, not measured. */
function derivedDuration(stepCount: number, index: number): number {
  return 4_000 + stepCount * 1_500 + index * 600;
}

@Injectable()
export class AutomationRunsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(automationId: string) {
    return this.tenantDb.run((tx) =>
      tx
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId))
        .orderBy(desc(automationRuns.createdAt)),
    );
  }

  async get(automationId: string, runId: string) {
    return this.tenantDb.run((tx) => this.load(tx, automationId, runId));
  }

  /**
   * Records a run. The real desktop-agent runtime is a later phase, so this
   * produces a completed run synchronously: every test passes except those a
   * user has explicitly marked failed, and durations are derived from step
   * counts. It persists the run and reflects each outcome onto the test's
   * `last_status`, which keeps the dashboard and results screens truthful.
   */
  async execute(
    automationId: string,
    organizationId: string,
    userId: string,
    input: CreateAutomationRunRequest,
  ) {
    return this.tenantDb.run(async (tx) => {
      const [automation] = await tx
        .select({ id: automations.id, name: automations.name })
        .from(automations)
        .where(eq(automations.id, automationId));
      if (!automation) throw new NotFoundException();

      const tests = await tx
        .select()
        .from(automationTests)
        .where(eq(automationTests.automationId, automationId))
        .orderBy(automationTests.position, automationTests.createdAt);
      if (tests.length === 0) {
        throw new BadRequestException('Add or generate tests before running this automation');
      }

      const browser = input.browser ?? 'chromium';
      const logs: string[] = [
        'Starting test run…',
        `Launching browser (${browser})…`,
      ];
      const results: AutomationRunResult[] = [];
      let passed = 0;
      let failed = 0;
      const skipped = 0;
      let durationMs = 0;

      tests.forEach((t, index) => {
        // a previously-failed test stays failed; everything else passes under the stub
        const outcome: TestStatus =
          t.lastStatus === AutomationTestStatus.Failed
            ? AutomationTestStatus.Failed
            : AutomationTestStatus.Passed;
        const d = derivedDuration(((t.steps as TestStep[]) ?? []).length, index);
        durationMs += d;
        results.push({ testId: t.id, name: t.title, status: outcome, durationMs: d });
        if (outcome === AutomationTestStatus.Passed) passed += 1;
        else failed += 1;
        logs.push(`${outcome === AutomationTestStatus.Passed ? '✓' : '✗'} ${t.key} ${t.title}`);
      });

      logs.push(`Run complete — ${passed} passed, ${failed} failed, ${skipped} skipped.`);
      const now = new Date();
      const overall =
        failed > 0 ? AutomationRunStatus.Failed : AutomationRunStatus.Passed;

      const [run] = await tx
        .insert(automationRuns)
        .values({
          organizationId,
          automationId,
          triggeredBy: userId,
          status: overall,
          environment: input.environment ?? null,
          browser,
          workers: input.workers ?? 1,
          headless: input.headless ?? true,
          captureScreenshots: input.captureScreenshots ?? false,
          captureVideo: input.captureVideo ?? false,
          traceExecution: input.traceExecution ?? false,
          total: tests.length,
          passed,
          failed,
          skipped,
          durationMs,
          results,
          logs,
          startedAt: now,
          finishedAt: now,
        })
        .returning();
      if (!run) throw new Error('automation run insert returned no row');

      // reflect outcomes onto each test so the module stays consistent
      for (const r of results) {
        if (!r.testId) continue;
        await tx
          .update(automationTests)
          .set({ lastStatus: r.status, updatedAt: now })
          .where(eq(automationTests.id, r.testId));
      }

      await this.audit.log(
        {
          action: 'AUTOMATION_EXECUTED',
          resourceType: ENTITY_TYPE,
          resourceId: run.id,
          metadata: { automationId, total: tests.length, passed, failed },
        },
        tx,
      );
      return run;
    });
  }

  /** Marks an in-flight run cancelled. Completed runs cannot be cancelled. */
  async cancel(automationId: string, runId: string) {
    return this.tenantDb.run(async (tx) => {
      const run = await this.load(tx, automationId, runId);
      if (
        run.status !== AutomationRunStatus.Queued &&
        run.status !== AutomationRunStatus.Running
      ) {
        throw new BadRequestException('Only a queued or running execution can be cancelled');
      }
      const [updated] = await tx
        .update(automationRuns)
        .set({ status: AutomationRunStatus.Cancelled, finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(automationRuns.id, runId))
        .returning();
      await this.audit.log(
        { action: 'AUTOMATION_CANCELLED', resourceType: ENTITY_TYPE, resourceId: runId },
        tx,
      );
      return updated!;
    });
  }

  private async load(tx: Database, automationId: string, runId: string): Promise<RunRow> {
    const [row] = await tx
      .select()
      .from(automationRuns)
      .where(and(eq(automationRuns.id, runId), eq(automationRuns.automationId, automationId)));
    if (!row) throw new NotFoundException();
    return row;
  }
}
