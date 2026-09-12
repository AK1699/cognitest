import { Controller, Get } from '@nestjs/common';

import type { AuthUser } from '@cognitest/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/organizations')
  async myOrganizations(@CurrentUser() user: AuthUser) {
    return { organizations: await this.users.listOrganizations(user.id) };
  }
}
