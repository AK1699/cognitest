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
import { AutomationRunsService } from './automation-runs.service';
import { AutomationsService } from './automations.service';
import {
  CreateAutomationDto,
  CreateAutomationRunDto,
  CreateAutomationTestDto,
  UpdateAutomationDto,
  UpdateAutomationTestDto,
} from './dto/automation.dto';

/**
 * Automation module: web-automation flows, their executable test cases and run
 * records — all scoped to a project. Tests and runs nest under an automation;
 * `assertInProject` guards every nested route so a sibling project's automation
 * id can never be reached through this project's path.
 */
@UseGuards(ProjectAccessGuard)
@Controller('organizations/:organizationId/projects/:projectId/automations')
export class AutomationController {
  constructor(
    private readonly automations: AutomationsService,
    private readonly runs: AutomationRunsService,
  ) {}

  // --------------------------------------------------------------- automations

  @RequirePermission('automation.read')
  @Get()
  async list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return { automations: await this.automations.list(projectId) };
  }

  @RequirePermission('automation.create')
  @Post()
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAutomationDto,
  ) {
    return {
      automation: await this.automations.create(projectId, organizationId, user.id, body),
    };
  }

  @RequirePermission('automation.read')
  @Get(':automationId')
  async get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    return { automation: await this.automations.getSummary(projectId, automationId) };
  }

  @RequirePermission('automation.update')
  @Patch(':automationId')
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Body() body: UpdateAutomationDto,
  ) {
    return { automation: await this.automations.update(projectId, automationId, body) };
  }

  @RequirePermission('automation.delete')
  @HttpCode(200)
  @Delete(':automationId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    await this.automations.remove(projectId, automationId);
    return { message: 'Automation deleted' };
  }

  /** Generates automation tests from the project's test cases (or the flow). */
  @RequirePermission('automation.create')
  @HttpCode(200)
  @Post(':automationId/generate')
  async generate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automations.generate(projectId, organizationId, user.id, automationId);
  }

  // --------------------------------------------------------------------- tests

  @RequirePermission('automation.read')
  @Get(':automationId/tests')
  async listTests(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { tests: await this.automations.listTests(automationId) };
  }

  @RequirePermission('automation.create')
  @Post(':automationId/tests')
  async createTest(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAutomationTestDto,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return {
      test: await this.automations.createTest(automationId, organizationId, user.id, body),
    };
  }

  @RequirePermission('automation.read')
  @Get(':automationId/tests/:testId')
  async getTest(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Param('testId', ParseUUIDPipe) testId: string,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { test: await this.automations.getTest(automationId, testId) };
  }

  @RequirePermission('automation.update')
  @Patch(':automationId/tests/:testId')
  async updateTest(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Param('testId', ParseUUIDPipe) testId: string,
    @Body() body: UpdateAutomationTestDto,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { test: await this.automations.updateTest(automationId, testId, body) };
  }

  @RequirePermission('automation.delete')
  @HttpCode(200)
  @Delete(':automationId/tests/:testId')
  async removeTest(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Param('testId', ParseUUIDPipe) testId: string,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    await this.automations.removeTest(automationId, testId);
    return { message: 'Test deleted' };
  }

  // ---------------------------------------------------------------------- runs

  @RequirePermission('automation.read')
  @Get(':automationId/runs')
  async listRuns(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { runs: await this.runs.list(automationId) };
  }

  @RequirePermission('automation.execute')
  @Post(':automationId/runs')
  async execute(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAutomationRunDto,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { run: await this.runs.execute(automationId, organizationId, user.id, body) };
  }

  @RequirePermission('automation.read')
  @Get(':automationId/runs/:runId')
  async getRun(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { run: await this.runs.get(automationId, runId) };
  }

  @RequirePermission('automation.cancel')
  @HttpCode(200)
  @Post(':automationId/runs/:runId/cancel')
  async cancelRun(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    await this.automations.assertInProject(projectId, automationId);
    return { run: await this.runs.cancel(automationId, runId) };
  }
}
