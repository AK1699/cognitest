import { Controller } from '@nestjs/common';

import { InvitationsService } from './invitations.service';

/** Placeholder — no routes yet. */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}
}
