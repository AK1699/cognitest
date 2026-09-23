import { z } from 'zod';

import {
  APPROVAL_STATUSES,
  REQUIREMENT_STATUSES,
  TEST_CASE_PRIORITIES,
  TEST_PLAN_STATUSES,
} from '../enums';

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export const requirementSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  projectId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(REQUIREMENT_STATUSES),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Requirement = z.infer<typeof requirementSchema>;

export const createRequirementRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).optional(),
});

export const updateRequirementRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
});

// ---------------------------------------------------------------------------
// Test plans (versioned; approval references a specific version — spec §54)
// ---------------------------------------------------------------------------

export const testPlanSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  projectId: z.uuid(),
  requirementId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(TEST_PLAN_STATUSES),
  version: z.number().int().positive(),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TestPlan = z.infer<typeof testPlanSchema>;

export const createTestPlanRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).optional(),
  requirementId: z.uuid().optional(),
});

export const updateTestPlanRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  requirementId: z.uuid().nullable().optional(),
});

export const approvalDecisionRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2000).optional(),
});

export const approvalSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  entityType: z.string(),
  entityId: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(APPROVAL_STATUSES),
  comment: z.string().nullable(),
  requestedBy: z.uuid(),
  decidedBy: z.uuid().nullable(),
  decidedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Approval = z.infer<typeof approvalSchema>;

// ---------------------------------------------------------------------------
// Test suites & cases
// ---------------------------------------------------------------------------

export const testSuiteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  testPlanId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TestSuite = z.infer<typeof testSuiteSchema>;

export const createTestSuiteRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateTestSuiteRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const testStepSchema = z.object({
  action: z.string().min(1).max(2000),
  expected: z.string().max(2000).optional(),
});
export type TestStep = z.infer<typeof testStepSchema>;

export const testCaseSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  testSuiteId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  steps: z.array(testStepSchema),
  priority: z.enum(TEST_CASE_PRIORITIES),
  position: z.number().int(),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TestCase = z.infer<typeof testCaseSchema>;

export const createTestCaseRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).optional(),
  steps: z.array(testStepSchema).max(200).optional(),
  priority: z.enum(TEST_CASE_PRIORITIES).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateTestCaseRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  steps: z.array(testStepSchema).max(200).optional(),
  priority: z.enum(TEST_CASE_PRIORITIES).optional(),
  position: z.number().int().min(0).optional(),
});
