import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { EXTERNAL_LINK_ENTITY_TYPES } from '@cognitest/shared';
import type { AuthUser, ExternalLinkEntityType } from '@cognitest/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { ProjectAccessGuard } from '../authz/guards/project-access.guard';
import { CreateExternalLinkDto, ImportRequirementsDto } from './dto/integrations.dto';
import { ExternalLinksService } from './external-links.service';

function parseEntityType(value: string): ExternalLinkEntityType {
  if (!(EXTERNAL_LINK_ENTITY_TYPES as readonly string[]).includes(value)) {
    throw new BadRequestException('Invalid entityType');
  }
  return value as ExternalLinkEntityType;
}

/** Project-scoped: link product entities to external items, and import issues. */
@UseGuards(ProjectAccessGuard)
@Controller('organizations/:organizationId/projects/:projectId')
export class ExternalLinksController {
  constructor(private readonly links: ExternalLinksService) {}

  @RequirePermission('integration.read')
  @Get('external-links')
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('entityType') entityType: string,
    @Query('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return {
      links: await this.links.list(organizationId, parseEntityType(entityType), entityId),
    };
  }

  @RequirePermission('integration.create')
  @Post('external-links')
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateExternalLinkDto,
  ) {
    return { link: await this.links.create(organizationId, user.id, body) };
  }

  @RequirePermission('integration.update')
  @HttpCode(200)
  @Post('external-links/:linkId/sync')
  async sync(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return { link: await this.links.sync(organizationId, linkId) };
  }

  @RequirePermission('integration.delete')
  @HttpCode(200)
  @Delete('external-links/:linkId')
  async remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.links.remove(organizationId, linkId);
    return { message: 'Link removed' };
  }

  @RequirePermission('requirement.create')
  @HttpCode(200)
  @Post('integrations/import-requirements')
  async import(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ImportRequirementsDto,
  ) {
    return this.links.importRequirements(organizationId, projectId, user.id, body);
  }
}
