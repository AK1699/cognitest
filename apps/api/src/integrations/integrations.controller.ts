import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';

import type { AuthUser } from '@cognitest/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { ConnectIntegrationDto } from './dto/integrations.dto';
import { IntegrationsService } from './integrations.service';

/** Org-scoped: connect/verify/disconnect providers and search their items. */
@Controller('organizations/:organizationId/integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @RequirePermission('integration.read')
  @Get()
  async list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return { integrations: await this.integrations.list(organizationId) };
  }

  @RequirePermission('integration.read')
  @Get(':provider')
  async get(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('provider') provider: string,
  ) {
    return { integration: await this.integrations.get(organizationId, this.integrations.assertProvider(provider)) };
  }

  @RequirePermission('integration.configure')
  @Put(':provider')
  async connect(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('provider') provider: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ConnectIntegrationDto,
  ) {
    return {
      integration: await this.integrations.connect(
        organizationId,
        user.id,
        this.integrations.assertProvider(provider),
        body,
      ),
    };
  }

  @RequirePermission('integration.configure')
  @HttpCode(200)
  @Post(':provider/verify')
  async verify(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('provider') provider: string,
  ) {
    return { integration: await this.integrations.verify(organizationId, this.integrations.assertProvider(provider)) };
  }

  @RequirePermission('integration.delete')
  @HttpCode(200)
  @Delete(':provider')
  async disconnect(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('provider') provider: string,
  ) {
    await this.integrations.disconnect(organizationId, this.integrations.assertProvider(provider));
    return { message: 'Integration disconnected' };
  }

  @RequirePermission('integration.read')
  @Get(':provider/search')
  async search(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('provider') provider: string,
    @Query('q') q = '',
  ) {
    return {
      results: await this.integrations.search(organizationId, this.integrations.assertProvider(provider), q),
    };
  }
}
