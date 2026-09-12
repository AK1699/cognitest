import { acceptInvitationRequestSchema, createInvitationRequestSchema } from '@cognitest/shared';

export class CreateInvitationDto {
  static readonly zodSchema = createInvitationRequestSchema;
  email!: string;
  roleId!: string;
  teamId?: string;
}

export class AcceptInvitationDto {
  static readonly zodSchema = acceptInvitationRequestSchema;
  token!: string;
}
