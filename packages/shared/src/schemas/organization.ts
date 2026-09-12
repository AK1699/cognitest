import { z } from 'zod';

import { MEMBER_STATUSES, ONBOARDING_STATUSES, ORG_STATUSES } from '../enums';

export const organizationSlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, 'Slug must be 3–48 chars, lowercase kebab-case');

export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: organizationSlugSchema,
  status: z.enum(ORG_STATUSES),
  onboardingStatus: z.enum(ONBOARDING_STATUSES),
  onboardingStep: z.string().nullable(),
  onboardingCompletedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const organizationMemberSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid(),
  roleId: z.uuid().nullable(),
  status: z.enum(MEMBER_STATUSES),
  joinedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
