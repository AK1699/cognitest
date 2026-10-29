import { z } from 'zod';

import {
  AUTOMATION_FRAMEWORKS,
  AUTOMATION_METHODS,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_STATUSES,
  AUTOMATION_TEST_STATUSES,
  TEST_CASE_PRIORITIES,
} from '../enums';
import { testStepSchema } from './test-artifacts';

// ---------------------------------------------------------------------------
// Automations — a saved web-automation flow within a project. The visual
// builder serialises its canvas into `flow`; `config` holds the run settings
// shown on the Settings tab. Both are jsonb and intentionally permissive while
// the execution runtime (desktop agents) is still a later phase.
// ---------------------------------------------------------------------------

/**
 * One node on the Visual Builder canvas (Open Browser, Navigate, Enter Text,
 * Click, Wait, Assert…). `config` is free-form per action type; validating it
 * tightly would couple the schema to a runtime that does not exist yet.
 */
export const automationStepSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(60),
  label: z.string().max(200),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type AutomationStep = z.infer<typeof automationStepSchema>;

/** A named environment the automation can run against (Settings → Environments). */
export const automationEnvironmentSchema = z.object({
  name: z.string().min(1).max(60),
  baseUrl: z.string().max(500).optional(),
});
export type AutomationEnvironment = z.infer<typeof automationEnvironmentSchema>;

/** A reusable value referenced from builder steps as {{name}} (Builder → Variables). */
export const automationVariableSchema = z.object({
  name: z.string().min(1).max(60),
  value: z.string().max(2000),
  secret: z.boolean().optional(),
});
export type AutomationVariable = z.infer<typeof automationVariableSchema>;

/** Run/framework settings (Settings tab). All optional — sensible defaults live server-side. */
export const automationConfigSchema = z.object({
  defaultBrowser: z.string().max(60).optional(),
  baseUrl: z.string().max(500).optional(),
  parallelExecution: z.boolean().optional(),
  retryOnFailure: z.boolean().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  timeoutSeconds: z.number().int().min(0).max(86_400).optional(),
  environments: z.array(automationEnvironmentSchema).max(50).optional(),
  notifyOnFailure: z.boolean().optional(),
  notifyOnSuccess: z.boolean().optional(),
  ciProvider: z.string().max(60).optional(),
  variables: z.array(automationVariableSchema).max(100).optional(),
});
export type AutomationConfig = z.infer<typeof automationConfigSchema>;

export const automationSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  method: z.enum(AUTOMATION_METHODS),
  framework: z.enum(AUTOMATION_FRAMEWORKS),
  status: z.enum(AUTOMATION_STATUSES),
  tags: z.array(z.string()),
  flow: z.array(automationStepSchema),
  config: automationConfigSchema,
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Automation = z.infer<typeof automationSchema>;

/** An automation plus derived counts for list/overview surfaces. */
export const automationSummarySchema = automationSchema.extend({
  testCount: z.number().int().nonnegative(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  lastRunStatus: z.enum(AUTOMATION_RUN_STATUSES).nullable(),
  lastRunAt: z.coerce.date().nullable(),
});
export type AutomationSummary = z.infer<typeof automationSummarySchema>;

export const createAutomationRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(10_000).optional(),
  method: z.enum(AUTOMATION_METHODS).optional(),
  framework: z.enum(AUTOMATION_FRAMEWORKS).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  flow: z.array(automationStepSchema).max(200).optional(),
  config: automationConfigSchema.optional(),
});
export type CreateAutomationRequest = z.infer<typeof createAutomationRequestSchema>;

// status/framework/flow/config/tags are all editable after creation; method is
// provenance — set once, immutable thereafter.
export const updateAutomationRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  framework: z.enum(AUTOMATION_FRAMEWORKS).optional(),
  status: z.enum(AUTOMATION_STATUSES).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  flow: z.array(automationStepSchema).max(200).optional(),
  config: automationConfigSchema.optional(),
});
export type UpdateAutomationRequest = z.infer<typeof updateAutomationRequestSchema>;

// ---------------------------------------------------------------------------
// Automation tests — the executable test cases that live inside an automation
// (the Tests tab / TC-001 detail). Steps reuse the shared testStepSchema.
// ---------------------------------------------------------------------------

export const automationTestSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  automationId: z.uuid(),
  key: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  priority: z.enum(TEST_CASE_PRIORITIES),
  tags: z.array(z.string()),
  preconditions: z.array(z.string()),
  steps: z.array(testStepSchema),
  expectedResult: z.string().nullable(),
  code: z.string().nullable(),
  lastStatus: z.enum(AUTOMATION_TEST_STATUSES),
  position: z.number().int(),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AutomationTest = z.infer<typeof automationTestSchema>;

export const createAutomationTestRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  key: z.string().max(40).optional(),
  description: z.string().max(10_000).optional(),
  category: z.string().max(60).optional(),
  priority: z.enum(TEST_CASE_PRIORITIES).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  preconditions: z.array(z.string().max(500)).max(50).optional(),
  steps: z.array(testStepSchema).max(200).optional(),
  expectedResult: z.string().max(10_000).optional(),
  code: z.string().max(100_000).optional(),
  position: z.number().int().min(0).optional(),
});
export type CreateAutomationTestRequest = z.infer<typeof createAutomationTestRequestSchema>;

export const updateAutomationTestRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  priority: z.enum(TEST_CASE_PRIORITIES).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  preconditions: z.array(z.string().max(500)).max(50).optional(),
  steps: z.array(testStepSchema).max(200).optional(),
  expectedResult: z.string().max(10_000).nullable().optional(),
  code: z.string().max(100_000).nullable().optional(),
  status: z.enum(AUTOMATION_TEST_STATUSES).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateAutomationTestRequest = z.infer<typeof updateAutomationTestRequestSchema>;

// ---------------------------------------------------------------------------
// Runs — one execution record. Until the agent runtime lands, a run is created
// already-completed with results derived from the automation's tests.
// ---------------------------------------------------------------------------

export const automationRunResultSchema = z.object({
  testId: z.uuid().nullable(),
  name: z.string(),
  status: z.enum(AUTOMATION_TEST_STATUSES),
  durationMs: z.number().int().nonnegative(),
});
export type AutomationRunResult = z.infer<typeof automationRunResultSchema>;

export const automationRunSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  automationId: z.uuid(),
  status: z.enum(AUTOMATION_RUN_STATUSES),
  environment: z.string().nullable(),
  browser: z.string().nullable(),
  workers: z.number().int().positive(),
  headless: z.boolean(),
  captureScreenshots: z.boolean(),
  captureVideo: z.boolean(),
  traceExecution: z.boolean(),
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  results: z.array(automationRunResultSchema),
  logs: z.array(z.string()),
  triggeredBy: z.uuid(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AutomationRun = z.infer<typeof automationRunSchema>;

export const createAutomationRunRequestSchema = z.object({
  environment: z.string().max(60).optional(),
  browser: z.string().max(60).optional(),
  workers: z.number().int().min(1).max(64).optional(),
  headless: z.boolean().optional(),
  captureScreenshots: z.boolean().optional(),
  captureVideo: z.boolean().optional(),
  traceExecution: z.boolean().optional(),
});
export type CreateAutomationRunRequest = z.infer<typeof createAutomationRunRequestSchema>;
