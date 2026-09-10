import { Controller } from '@nestjs/common';

import { OrganizationsService } from './organizations.service';

/** Placeholder — no routes yet. */
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}
}
