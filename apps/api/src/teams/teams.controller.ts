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
} from '@nestjs/common';

import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { CreateTeamDto, TeamMemberDto, UpdateTeamDto } from './dto/team.dto';
import { TeamsService } from './teams.service';

@Controller('organizations/:organizationId/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @RequirePermission('team.read')
  @Get()
  async list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return { teams: await this.teams.list(organizationId) };
  }

  @RequirePermission('team.create')
  @Post()
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: CreateTeamDto,
  ) {
    return { team: await this.teams.create(organizationId, body) };
  }

  @RequirePermission('team.update')
  @Patch(':teamId')
  async update(@Param('teamId', ParseUUIDPipe) teamId: string, @Body() body: UpdateTeamDto) {
    return { team: await this.teams.update(teamId, body) };
  }

  @RequirePermission('team.delete')
  @HttpCode(200)
  @Delete(':teamId')
  async remove(@Param('teamId', ParseUUIDPipe) teamId: string) {
    await this.teams.remove(teamId);
    return { message: 'Team deleted' };
  }

  @RequirePermission('team.read')
  @Get(':teamId/members')
  async members(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return { members: await this.teams.listMembers(teamId) };
  }

  @RequirePermission('team.update')
  @Post(':teamId/members')
  async addMember(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() body: TeamMemberDto,
  ) {
    await this.teams.addMember(organizationId, teamId, body.userId);
    return { message: 'Member added' };
  }

  @RequirePermission('team.update')
  @HttpCode(200)
  @Delete(':teamId/members/:userId')
  async removeMember(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.teams.removeMember(organizationId, teamId, userId);
    return { message: 'Member removed' };
  }
}
