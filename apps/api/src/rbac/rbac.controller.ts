import { Controller } from '@nestjs/common';

import { RbacService } from './rbac.service';

/** Placeholder — no routes yet. */
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}
}
