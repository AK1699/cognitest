import {
  approvalDecisionRequestSchema,
  createRequirementRequestSchema,
  createTestCaseRequestSchema,
  createTestDesignRequestSchema,
  createTestPlanRequestSchema,
  createTestSuiteRequestSchema,
  updateRequirementRequestSchema,
  updateTestCaseRequestSchema,
  updateTestDesignRequestSchema,
  updateTestPlanRequestSchema,
  updateTestSuiteRequestSchema,
} from '@cognitest/shared';
import type {
  DesignSource,
  RequirementStatus,
  TestCasePriority,
  TestStep,
} from '@cognitest/shared';

export class CreateTestDesignDto {
  static readonly zodSchema = createTestDesignRequestSchema;
  name!: string;
  description?: string;
  source?: DesignSource;
}

export class UpdateTestDesignDto {
  static readonly zodSchema = updateTestDesignRequestSchema;
  name?: string;
  description?: string | null;
}

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
