import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthUser } from '@cognitest/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { ProjectAccessGuard } from '../authz/guards/project-access.guard';
import {
  ApprovalDecisionDto,
  CreateRequirementDto,
  CreateTestCaseDto,
  CreateTestPlanDto,
  CreateTestSuiteDto,
  UpdateRequirementDto,
  UpdateTestCaseDto,
  UpdateTestPlanDto,
  UpdateTestSuiteDto,
} from './dto/test-artifacts.dto';
import { RequirementsService } from './requirements.service';
import { TestCasesService } from './test-cases.service';
import { TestPlansService } from './test-plans.service';

@UseGuards(ProjectAccessGuard)
@Controller('organizations/:organizationId/projects/:projectId')
export class TestArtifactsController {
  constructor(
    private readonly requirements: RequirementsService,
    private readonly plans: TestPlansService,
    private readonly cases: TestCasesService,
  ) {}

  // ---------------------------------------------------------- requirements --

  @RequirePermission('requirement.read')
  @Get('requirements')
  async listRequirements(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return { requirements: await this.requirements.list(projectId) };
  }

  @RequirePermission('requirement.create')
  @Post('requirements')
  async createRequirement(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRequirementDto,
  ) {
    return {
      requirement: await this.requirements.create(projectId, organizationId, user.id, body),
    };
  }

  @RequirePermission('requirement.read')
  @Get('requirements/:requirementId')
  async getRequirement(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    return { requirement: await this.requirements.get(projectId, requirementId) };
  }

  @RequirePermission('requirement.update')
  @Patch('requirements/:requirementId')
  async updateRequirement(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() body: UpdateRequirementDto,
  ) {
    return { requirement: await this.requirements.update(projectId, requirementId, body) };
  }

  @RequirePermission('requirement.delete')
  @HttpCode(200)
  @Delete('requirements/:requirementId')
  async removeRequirement(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    await this.requirements.remove(projectId, requirementId);
    return { message: 'Requirement deleted' };
  }

  // ------------------------------------------------------------ test plans --

  @RequirePermission('test_plan.read')
  @Get('test-plans')
  async listPlans(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return { testPlans: await this.plans.list(projectId) };
  }

  @RequirePermission('test_plan.create')
  @Post('test-plans')
  async createPlan(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTestPlanDto,
  ) {
    return { testPlan: await this.plans.create(projectId, organizationId, user.id, body) };
  }

  @RequirePermission('test_plan.read')
  @Get('test-plans/:testPlanId')
  async getPlan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
  ) {
    return { testPlan: await this.plans.get(projectId, testPlanId) };
  }

  @RequirePermission('test_plan.update')
  @Patch('test-plans/:testPlanId')
  async updatePlan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
    @Body() body: UpdateTestPlanDto,
  ) {
    return { testPlan: await this.plans.update(projectId, testPlanId, body) };
  }

  @RequirePermission('test_plan.update')
  @HttpCode(200)
  @Post('test-plans/:testPlanId/submit')
  async submitPlan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return { testPlan: await this.plans.submit(projectId, testPlanId, user.id) };
  }

  /** Approval is a distinct permission (spec §53) — editing ≠ approving. */
  @RequirePermission('test_plan.approve')
  @HttpCode(200)
  @Post('test-plans/:testPlanId/decision')
  async decidePlan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ApprovalDecisionDto,
  ) {
    return {
      testPlan: await this.plans.decide(
        projectId,
        testPlanId,
        user.id,
        body.decision,
        body.comment,
      ),
    };
  }

  @RequirePermission('test_plan.read')
  @Get('test-plans/:testPlanId/approvals')
  async planApprovals(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
  ) {
    return { approvals: await this.plans.listApprovals(projectId, testPlanId) };
  }

  @RequirePermission('test_plan.delete')
  @HttpCode(200)
  @Delete('test-plans/:testPlanId')
  async archivePlan(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
  ) {
    await this.plans.archive(projectId, testPlanId);
    return { message: 'Test plan archived' };
  }

  // ----------------------------------------------------------- test suites --

  @RequirePermission('test_suite.read')
  @Get('test-plans/:testPlanId/suites')
  async listSuites(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
  ) {
    return { testSuites: await this.cases.listSuites(projectId, testPlanId) };
  }

  @RequirePermission('test_suite.create')
  @Post('test-plans/:testPlanId/suites')
  async createSuite(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('testPlanId', ParseUUIDPipe) testPlanId: string,
    @Body() body: CreateTestSuiteDto,
  ) {
    return {
      testSuite: await this.cases.createSuite(projectId, organizationId, testPlanId, body),
    };
  }

  @RequirePermission('test_suite.update')
  @Patch('test-suites/:suiteId')
  async updateSuite(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('suiteId', ParseUUIDPipe) suiteId: string,
    @Body() body: UpdateTestSuiteDto,
  ) {
    return { testSuite: await this.cases.updateSuite(projectId, suiteId, body) };
  }

  @RequirePermission('test_suite.delete')
  @HttpCode(200)
  @Delete('test-suites/:suiteId')
  async removeSuite(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('suiteId', ParseUUIDPipe) suiteId: string,
  ) {
    await this.cases.removeSuite(projectId, suiteId);
    return { message: 'Test suite deleted' };
  }

  // ------------------------------------------------------------ test cases --

  @RequirePermission('test_case.read')
  @Get('test-suites/:suiteId/cases')
  async listCases(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('suiteId', ParseUUIDPipe) suiteId: string,
  ) {
    return { testCases: await this.cases.listCases(projectId, suiteId) };
  }

  @RequirePermission('test_case.create')
  @Post('test-suites/:suiteId/cases')
  async createCase(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('suiteId', ParseUUIDPipe) suiteId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTestCaseDto,
  ) {
    return {
      testCase: await this.cases.createCase(projectId, organizationId, suiteId, user.id, body),
    };
  }

  @RequirePermission('test_case.update')
  @Patch('test-cases/:caseId')
  async updateCase(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() body: UpdateTestCaseDto,
  ) {
    return { testCase: await this.cases.updateCase(projectId, caseId, body) };
  }

  @RequirePermission('test_case.delete')
  @HttpCode(200)
  @Delete('test-cases/:caseId')
  async removeCase(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    await this.cases.removeCase(projectId, caseId);
    return { message: 'Test case deleted' };
  }
}
