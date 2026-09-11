import { Controller } from '@nestjs/common';

import { TeamsService } from './teams.service';

/** Placeholder — no routes yet. */
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}
}
