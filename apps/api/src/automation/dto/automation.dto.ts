import {
  createAutomationRequestSchema,
  createAutomationRunRequestSchema,
  createAutomationTestRequestSchema,
  updateAutomationRequestSchema,
  updateAutomationTestRequestSchema,
} from '@cognitest/shared';
import type {
  AutomationConfig,
  AutomationFramework,
  AutomationMethod,
  AutomationStatus,
  AutomationStep,
  AutomationTestStatus,
  TestCasePriority,
  TestStep,
} from '@cognitest/shared';

export class CreateAutomationDto {
  static readonly zodSchema = createAutomationRequestSchema;
  name!: string;
  description?: string;
  method?: AutomationMethod;
  framework?: AutomationFramework;
  tags?: string[];
  flow?: AutomationStep[];
  config?: AutomationConfig;
}

export class UpdateAutomationDto {
  static readonly zodSchema = updateAutomationRequestSchema;
  name?: string;
  description?: string | null;
  framework?: AutomationFramework;
  status?: AutomationStatus;
  tags?: string[];
  flow?: AutomationStep[];
  config?: AutomationConfig;
}

export class CreateAutomationTestDto {
  static readonly zodSchema = createAutomationTestRequestSchema;
  title!: string;
  key?: string;
  description?: string;
  category?: string;
  priority?: TestCasePriority;
  tags?: string[];
  preconditions?: string[];
  steps?: TestStep[];
  expectedResult?: string;
  code?: string;
  position?: number;
}

export class UpdateAutomationTestDto {
  static readonly zodSchema = updateAutomationTestRequestSchema;
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: TestCasePriority;
  tags?: string[];
  preconditions?: string[];
  steps?: TestStep[];
  expectedResult?: string | null;
  code?: string | null;
  status?: AutomationTestStatus;
  position?: number;
}

export class CreateAutomationRunDto {
  static readonly zodSchema = createAutomationRunRequestSchema;
  environment?: string;
  browser?: string;
  workers?: number;
  headless?: boolean;
  captureScreenshots?: boolean;
  captureVideo?: boolean;
  traceExecution?: boolean;
}
