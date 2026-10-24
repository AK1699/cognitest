import { z } from 'zod';

import { DESIGN_SOURCES, DESIGN_STATUSES } from '../enums';

// ---------------------------------------------------------------------------
// Test designs — the entry point for a body of testing work: requirements are
// gathered under a design, analysed, then generated into plans/suites/cases.
// Approval is version-aware, mirroring test plans (spec §53–54).
// ---------------------------------------------------------------------------

export const testDesignSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  source: z.enum(DESIGN_SOURCES),
  status: z.enum(DESIGN_STATUSES),
  version: z.number().int().positive(),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TestDesign = z.infer<typeof testDesignSchema>;

/** A design plus derived counts for list/overview surfaces. */
export const testDesignSummarySchema = testDesignSchema.extend({
  requirementCount: z.number().int().nonnegative(),
  suiteCount: z.number().int().nonnegative(),
  caseCount: z.number().int().nonnegative(),
});
export type TestDesignSummary = z.infer<typeof testDesignSummarySchema>;

export const createTestDesignRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(10_000).optional(),
  source: z.enum(DESIGN_SOURCES).optional(),
});

// source is provenance — set at creation, immutable thereafter
export const updateTestDesignRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
});
