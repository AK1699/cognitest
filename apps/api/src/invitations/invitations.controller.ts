import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { AuthUser } from '@cognitest/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @RequirePermission('invitation.read')
  @Get('organizations/:organizationId/invitations')
  async list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return { invitations: await this.invitations.list(organizationId) };
  }

  @RequirePermission('invitation.create')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('organizations/:organizationId/invitations')
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateInvitationDto,
  ) {
    const invitation = await this.invitations.create(organizationId, user.id, body);
    // never echo the token hash back
    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        roleId: invitation.roleId,
        teamId: invitation.teamId,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  @RequirePermission('invitation.delete')
  @HttpCode(200)
  @Delete('organizations/:organizationId/invitations/:invitationId')
  async revoke(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    await this.invitations.revoke(organizationId, invitationId);
    return { message: 'Invitation revoked' };
  }

  /** Authenticated, non-tenant: the invitation itself is the authorization. */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('invitations/accept')
  async accept(@CurrentUser() user: AuthUser, @Body() body: AcceptInvitationDto) {
    const result = await this.invitations.accept(
      { id: user.id, email: user.email },
      body.token,
    );
    return { message: 'Invitation accepted', organizationId: result.organizationId };
  }
}
