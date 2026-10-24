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
import { DesignsService } from './designs.service';
import {
  ApprovalDecisionDto,
  CreateRequirementDto,
  CreateTestDesignDto,
  CreateTestPlanDto,
  UpdateRequirementDto,
  UpdateTestDesignDto,
} from './dto/test-artifacts.dto';
import { RequirementsService } from './requirements.service';
import { TestPlansService } from './test-plans.service';

/**
 * Design module: a test design groups requirements, analysis and generated
 * artefacts. Requirements and test plans are nested under a design here; suites
 * and cases continue to hang off the plan via TestArtifactsController.
 */
@UseGuards(ProjectAccessGuard)
@Controller('organizations/:organizationId/projects/:projectId')
export class DesignsController {
  constructor(
    private readonly designs: DesignsService,
    private readonly requirements: RequirementsService,
    private readonly plans: TestPlansService,
  ) {}

  // -------------------------------------------------------------- designs --

  @RequirePermission('test_design.read')
  @Get('designs')
  async list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return { designs: await this.designs.list(projectId) };
  }

  @RequirePermission('test_design.create')
  @Post('designs')
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTestDesignDto,
  ) {
    return { design: await this.designs.create(projectId, organizationId, user.id, body) };
  }

  @RequirePermission('test_design.read')
  @Get('designs/:designId')
  async get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
  ) {
    return { design: await this.designs.getSummary(projectId, designId) };
  }

  @RequirePermission('test_design.update')
  @Patch('designs/:designId')
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @Body() body: UpdateTestDesignDto,
  ) {
    return { design: await this.designs.update(projectId, designId, body) };
  }

  @RequirePermission('test_design.update')
  @HttpCode(200)
  @Post('designs/:designId/submit')
  async submit(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return { design: await this.designs.submit(projectId, designId, user.id) };
  }

  @RequirePermission('test_design.approve')
  @HttpCode(200)
  @Post('designs/:designId/decision')
  async decide(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ApprovalDecisionDto,
  ) {
    return {
      design: await this.designs.decide(
        projectId,
        designId,
        user.id,
        body.decision,
        body.comment,
      ),
    };
  }

  @RequirePermission('test_design.read')
  @Get('designs/:designId/approvals')
  async approvals(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
  ) {
    return { approvals: await this.designs.listApprovals(projectId, designId) };
  }

  @RequirePermission('test_design.delete')
  @HttpCode(200)
  @Delete('designs/:designId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
  ) {
    await this.designs.remove(projectId, designId);
    return { message: 'Test design deleted' };
  }

  // -------------------------------------------------- design requirements --

  @RequirePermission('requirement.read')
  @Get('designs/:designId/requirements')
  async listRequirements(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
  ) {
    await this.designs.assertInProject(projectId, designId);
    return { requirements: await this.requirements.listByDesign(designId) };
  }

  @RequirePermission('requirement.create')
  @Post('designs/:designId/requirements')
  async createRequirement(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRequirementDto,
  ) {
    await this.designs.assertInProject(projectId, designId);
    return {
      requirement: await this.requirements.create(projectId, organizationId, user.id, {
        ...body,
        designId,
      }),
    };
  }

  @RequirePermission('requirement.update')
  @Patch('designs/:designId/requirements/:requirementId')
  async updateRequirement(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() body: UpdateRequirementDto,
  ) {
    await this.designs.assertInProject(projectId, designId);
    return { requirement: await this.requirements.update(projectId, requirementId, body) };
  }

  @RequirePermission('requirement.delete')
  @HttpCode(200)
  @Delete('designs/:designId/requirements/:requirementId')
  async removeRequirement(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    await this.designs.assertInProject(projectId, designId);
    await this.requirements.remove(projectId, requirementId);
    return { message: 'Requirement deleted' };
  }

  // ---------------------------------------------------- design test plans --

  @RequirePermission('test_plan.read')
  @Get('designs/:designId/test-plans')
  async listPlans(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
  ) {
    await this.designs.assertInProject(projectId, designId);
    return { testPlans: await this.plans.listByDesign(designId) };
  }

  @RequirePermission('test_plan.create')
  @Post('designs/:designId/test-plans')
  async createPlan(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTestPlanDto,
  ) {
    await this.designs.assertInProject(projectId, designId);
    return {
      testPlan: await this.plans.create(projectId, organizationId, user.id, { ...body, designId }),
    };
  }

  /** Generates a plan + suites + cases from the approved design's requirements. */
  @RequirePermission('test_plan.create')
  @HttpCode(200)
  @Post('designs/:designId/generate')
  async generate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('designId', ParseUUIDPipe) designId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.designs.generateArtifacts(projectId, organizationId, user.id, designId);
  }
}
