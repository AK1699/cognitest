import { Controller } from '@nestjs/common';

import { UsersService } from './users.service';

/** Placeholder — no routes yet. */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
