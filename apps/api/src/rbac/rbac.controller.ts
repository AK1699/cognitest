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
  Put,
} from '@nestjs/common';

import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/rbac.dto';
import { RbacService } from './rbac.service';

@Controller('organizations/:organizationId')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @RequirePermission('role.read')
  @Get('roles')
  async roles(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return { roles: await this.rbac.listRoles(organizationId) };
  }

  @RequirePermission('role.read')
  @Get('permissions')
  async permissions() {
    return { permissions: await this.rbac.listPermissions() };
  }

  @RequirePermission('role.create')
  @Post('roles')
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: CreateRoleDto,
  ) {
    return { role: await this.rbac.createRole(organizationId, body) };
  }

  @RequirePermission('role.update')
  @Patch('roles/:roleId')
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: UpdateRoleDto,
  ) {
    return { role: await this.rbac.updateRole(organizationId, roleId, body) };
  }

  @RequirePermission('role.delete')
  @HttpCode(200)
  @Delete('roles/:roleId')
  async remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.rbac.deleteRole(organizationId, roleId);
    return { message: 'Role deleted' };
  }

  @RequirePermission('role.update')
  @Put('roles/:roleId/permissions')
  async setPermissions(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: SetRolePermissionsDto,
  ) {
    await this.rbac.setRolePermissions(organizationId, roleId, body.permissionKeys);
    return { message: 'Permissions updated' };
  }
}
