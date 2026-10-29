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

import type { AuthUser, Organization } from '@cognitest/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import {
  CreateOrganizationDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /** Workspace bootstrap — authenticated but deliberately outside tenant scope. */
  @Post('organizations')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateOrganizationDto,
  ): Promise<{ organization: Organization }> {
    const organization = await this.organizations.bootstrapOrganization(user.id, body);
    return { organization };
  }

  @RequirePermission('organization.read')
  @Get('organizations/:organizationId')
  async get(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<{ organization: Organization }> {
    return { organization: await this.organizations.get(organizationId) };
  }

  @RequirePermission('organization.update')
  @Patch('organizations/:organizationId')
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<{ organization: Organization }> {
    return { organization: await this.organizations.update(organizationId, body) };
  }

  @RequirePermission('organization.delete')
  @HttpCode(200)
  @Delete('organizations/:organizationId')
  async suspend(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<{ message: string }> {
    await this.organizations.suspend(organizationId);
    return { message: 'Organization suspended' };
  }

  @RequirePermission('member.read')
  @Get('organizations/:organizationId/members')
  async members(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return { members: await this.organizations.listMembers(organizationId) };
  }

  @RequirePermission('member.update')
  @Patch('organizations/:organizationId/members/:memberId')
  async changeRole(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: UpdateMemberDto,
  ): Promise<{ message: string }> {
    await this.organizations.changeMemberRole(organizationId, memberId, body.roleId);
    return { message: 'Role updated' };
  }

  @RequirePermission('member.delete')
  @HttpCode(200)
  @Delete('organizations/:organizationId/members/:memberId')
  async removeMember(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<{ message: string }> {
    await this.organizations.removeMember(organizationId, memberId);
    return { message: 'Member removed' };
  }
}
