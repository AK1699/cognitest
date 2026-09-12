import {
  approvalDecisionRequestSchema,
  createRequirementRequestSchema,
  createTestCaseRequestSchema,
  createTestPlanRequestSchema,
  createTestSuiteRequestSchema,
  updateRequirementRequestSchema,
  updateTestCaseRequestSchema,
  updateTestPlanRequestSchema,
  updateTestSuiteRequestSchema,
} from '@cognitest/shared';
import type { RequirementStatus, TestCasePriority, TestStep } from '@cognitest/shared';

export class CreateRequirementDto {
  static readonly zodSchema = createRequirementRequestSchema;
  title!: string;
  description?: string;
}

export class UpdateRequirementDto {
  static readonly zodSchema = updateRequirementRequestSchema;
  title?: string;
  description?: string | null;
  status?: RequirementStatus;
}

export class CreateTestPlanDto {
  static readonly zodSchema = createTestPlanRequestSchema;
  title!: string;
  description?: string;
  requirementId?: string;
}

export class UpdateTestPlanDto {
  static readonly zodSchema = updateTestPlanRequestSchema;
  title?: string;
  description?: string | null;
  requirementId?: string | null;
}

export class ApprovalDecisionDto {
  static readonly zodSchema = approvalDecisionRequestSchema;
  decision!: 'approved' | 'rejected';
  comment?: string;
}

export class CreateTestSuiteDto {
  static readonly zodSchema = createTestSuiteRequestSchema;
  title!: string;
  description?: string;
  position?: number;
}

export class UpdateTestSuiteDto {
  static readonly zodSchema = updateTestSuiteRequestSchema;
  title?: string;
  description?: string | null;
  position?: number;
}

export class CreateTestCaseDto {
  static readonly zodSchema = createTestCaseRequestSchema;
  title!: string;
  description?: string;
  steps?: TestStep[];
  priority?: TestCasePriority;
  position?: number;
}

export class UpdateTestCaseDto {
  static readonly zodSchema = updateTestCaseRequestSchema;
  title?: string;
  description?: string | null;
  steps?: TestStep[];
  priority?: TestCasePriority;
  position?: number;
}
