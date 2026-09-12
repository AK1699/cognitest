import {
  createOrganizationRequestSchema,
  updateMemberRequestSchema,
  updateOrganizationRequestSchema,
} from '@cognitest/shared';
import type { OnboardingStatus } from '@cognitest/shared';

export class CreateOrganizationDto {
  static readonly zodSchema = createOrganizationRequestSchema;
  name!: string;
  slug?: string;
}

export class UpdateOrganizationDto {
  static readonly zodSchema = updateOrganizationRequestSchema;
  name?: string;
  onboardingStatus?: OnboardingStatus;
  onboardingStep?: string | null;
}

export class UpdateMemberDto {
  static readonly zodSchema = updateMemberRequestSchema;
  roleId!: string;
}
