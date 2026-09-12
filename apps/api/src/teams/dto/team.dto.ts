import {
  createTeamRequestSchema,
  teamMemberRequestSchema,
  updateTeamRequestSchema,
} from '@cognitest/shared';

export class CreateTeamDto {
  static readonly zodSchema = createTeamRequestSchema;
  name!: string;
  slug!: string;
}

export class UpdateTeamDto {
  static readonly zodSchema = updateTeamRequestSchema;
  name?: string;
  slug?: string;
}

export class TeamMemberDto {
  static readonly zodSchema = teamMemberRequestSchema;
  userId!: string;
}
