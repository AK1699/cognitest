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
import { CreateProjectDto, ProjectMemberDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

// ProjectAccessGuard passes routes without a :projectId param, so applying it
// controller-wide covers exactly the per-project routes
@UseGuards(ProjectAccessGuard)
@Controller('organizations/:organizationId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @RequirePermission('project.read')
  @Get()
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return { projects: await this.projects.list(organizationId, user.id) };
  }

  @RequirePermission('project.create')
  @Post()
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateProjectDto,
  ) {
    return { project: await this.projects.create(organizationId, user.id, body) };
  }

  @RequirePermission('project.read')
  @Get(':projectId')
  async get(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return { project: await this.projects.get(projectId) };
  }

  @RequirePermission('project.update')
  @Patch(':projectId')
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return { project: await this.projects.update(projectId, body) };
  }

  @RequirePermission('project.delete')
  @HttpCode(200)
  @Delete(':projectId')
  async archive(@Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.projects.archive(projectId);
    return { message: 'Project archived' };
  }

  @RequirePermission('project.configure')
  @Get(':projectId/members')
  async members(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return { members: await this.projects.listMembers(projectId) };
  }

  @RequirePermission('project.configure')
  @Post(':projectId/members')
  async addMember(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: ProjectMemberDto,
  ) {
    await this.projects.addMember(organizationId, projectId, body.userId);
    return { message: 'Member added' };
  }

  @RequirePermission('project.configure')
  @HttpCode(200)
  @Delete(':projectId/members/:userId')
  async removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.projects.removeMember(projectId, userId);
    return { message: 'Member removed' };
  }
}
