import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  AUTOMATION_FRAMEWORKS,
  AUTOMATION_METHODS,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_STATUSES,
  AUTOMATION_TEST_STATUSES,
} from '@cognitest/shared';
import type {
  AutomationConfig,
  AutomationRunResult,
  AutomationStep,
  TestStep,
} from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';
import { projects } from './projects';
import { productSchema } from './schemas';
// reuse the existing test_case_priority enum rather than minting a parallel one
import { testCasePriority } from './test-artifacts';
import { users } from './users';

export const automationStatus = pgEnum('automation_status', AUTOMATION_STATUSES);
export const automationMethod = pgEnum('automation_method', AUTOMATION_METHODS);
export const automationFramework = pgEnum('automation_framework', AUTOMATION_FRAMEWORKS);
export const automationRunStatus = pgEnum('automation_run_status', AUTOMATION_RUN_STATUSES);
export const automationTestStatus = pgEnum('automation_test_status', AUTOMATION_TEST_STATUSES);

/**
 * A web-automation flow within a project. `flow` is the serialised Visual
 * Builder canvas and `config` the Settings-tab run options; both are jsonb so
 * the shape can evolve with the (still unbuilt) execution runtime. The
 * composite (id, organization_id) unique key lets tests and runs pin to the
 * same tenant via a composite FK, same pattern as test designs.
 */
export const automations = productSchema.table(
  'automations',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    method: automationMethod('method').notNull().default('visual'),
    framework: automationFramework('framework').notNull().default('playwright'),
    status: automationStatus('status').notNull().default('draft'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    flow: jsonb('flow').$type<AutomationStep[]>().notNull().default([]),
    config: jsonb('config').$type<AutomationConfig>().notNull().default({}),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('automations_project_idx').on(t.projectId),
    index('automations_org_created_idx').on(t.organizationId, t.createdAt),
    unique('automations_id_org_uq').on(t.id, t.organizationId),
    foreignKey({
      name: 'automations_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
  ],
);

/** An executable test case belonging to an automation (Tests tab / TC-xxx). */
export const automationTests = productSchema.table(
  'automation_tests',
  {
    id: id(),
    organizationId: uuid('organization_id').notNull(),
    automationId: uuid('automation_id').notNull(),
    key: text('key').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category'),
    priority: testCasePriority('priority').notNull().default('medium'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    preconditions: jsonb('preconditions').$type<string[]>().notNull().default([]),
    // [{ action, expected? }] — validated by @cognitest/shared testStepSchema
    steps: jsonb('steps').$type<TestStep[]>().notNull().default([]),
    expectedResult: text('expected_result'),
    code: text('code'),
    lastStatus: automationTestStatus('last_status').notNull().default('not_run'),
    position: integer('position').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('automation_tests_automation_idx').on(t.automationId),
    index('automation_tests_org_idx').on(t.organizationId),
    foreignKey({
      name: 'automation_tests_automation_org_fk',
      columns: [t.automationId, t.organizationId],
      foreignColumns: [automations.id, automations.organizationId],
    }).onDelete('cascade'),
  ],
);

/** One execution record for an automation. */
export const automationRuns = productSchema.table(
  'automation_runs',
  {
    id: id(),
    organizationId: uuid('organization_id').notNull(),
    automationId: uuid('automation_id').notNull(),
    status: automationRunStatus('status').notNull().default('queued'),
    environment: text('environment'),
    browser: text('browser'),
    workers: integer('workers').notNull().default(1),
    headless: boolean('headless').notNull().default(true),
    captureScreenshots: boolean('capture_screenshots').notNull().default(false),
    captureVideo: boolean('capture_video').notNull().default(false),
    traceExecution: boolean('trace_execution').notNull().default(false),
    total: integer('total').notNull().default(0),
    passed: integer('passed').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    durationMs: integer('duration_ms'),
    results: jsonb('results').$type<AutomationRunResult[]>().notNull().default([]),
    logs: jsonb('logs').$type<string[]>().notNull().default([]),
    triggeredBy: uuid('triggered_by')
      .notNull()
      .references(() => users.id),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('automation_runs_automation_idx').on(t.automationId, t.createdAt),
    index('automation_runs_org_idx').on(t.organizationId),
    foreignKey({
      name: 'automation_runs_automation_org_fk',
      columns: [t.automationId, t.organizationId],
      foreignColumns: [automations.id, automations.organizationId],
    }).onDelete('cascade'),
  ],
);
