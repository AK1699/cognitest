import {
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
  APPROVAL_STATUSES,
  REQUIREMENT_STATUSES,
  TEST_CASE_PRIORITIES,
  TEST_PLAN_STATUSES,
} from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';
import { projects } from './projects';
import { productSchema } from './schemas';
import { users } from './users';

export const requirementStatus = pgEnum('requirement_status', REQUIREMENT_STATUSES);
export const testPlanStatus = pgEnum('test_plan_status', TEST_PLAN_STATUSES);
export const approvalStatus = pgEnum('approval_status', APPROVAL_STATUSES);
export const testCasePriority = pgEnum('test_case_priority', TEST_CASE_PRIORITIES);

// Every artefact table denormalises organization_id: the composite FK pins the
// row to its parent's tenant and RLS scopes it without joins.

export const requirements = productSchema.table(
  'requirements',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: requirementStatus('status').notNull().default('draft'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('requirements_project_idx').on(t.projectId),
    index('requirements_org_created_idx').on(t.organizationId, t.createdAt),
    foreignKey({
      name: 'requirements_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
  ],
);

export const testPlans = productSchema.table(
  'test_plans',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').notNull(),
    requirementId: uuid('requirement_id').references(() => requirements.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description'),
    status: testPlanStatus('status').notNull().default('draft'),
    // approval is version-aware (spec §54): edits after approval bump this
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('test_plans_project_idx').on(t.projectId),
    index('test_plans_org_created_idx').on(t.organizationId, t.createdAt),
    unique('test_plans_id_org_uq').on(t.id, t.organizationId),
    foreignKey({
      name: 'test_plans_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
  ],
);

export const testSuites = productSchema.table(
  'test_suites',
  {
    id: id(),
    organizationId: uuid('organization_id').notNull(),
    testPlanId: uuid('test_plan_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('test_suites_plan_idx').on(t.testPlanId),
    index('test_suites_org_idx').on(t.organizationId),
    unique('test_suites_id_org_uq').on(t.id, t.organizationId),
    foreignKey({
      name: 'test_suites_plan_org_fk',
      columns: [t.testPlanId, t.organizationId],
      foreignColumns: [testPlans.id, testPlans.organizationId],
    }).onDelete('cascade'),
  ],
);

export const testCases = productSchema.table(
  'test_cases',
  {
    id: id(),
    organizationId: uuid('organization_id').notNull(),
    testSuiteId: uuid('test_suite_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    // [{ action, expected? }] — validated by @cognitest/shared testStepSchema
    steps: jsonb('steps').notNull().default([]),
    priority: testCasePriority('priority').notNull().default('medium'),
    position: integer('position').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('test_cases_suite_idx').on(t.testSuiteId),
    index('test_cases_org_idx').on(t.organizationId),
    foreignKey({
      name: 'test_cases_suite_org_fk',
      columns: [t.testSuiteId, t.organizationId],
      foreignColumns: [testSuites.id, testSuites.organizationId],
    }).onDelete('cascade'),
  ],
);

/** Version-aware approvals (spec §54); one row per entity version. */
export const approvals = productSchema.table(
  'approvals',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    version: integer('version').notNull(),
    status: approvalStatus('status').notNull().default('pending'),
    comment: text('comment'),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('approvals_entity_version_uq').on(t.entityType, t.entityId, t.version),
    index('approvals_org_idx').on(t.organizationId),
  ],
);
