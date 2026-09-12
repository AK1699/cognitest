import { z } from 'zod';

export const teamSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamMemberSchema = z.object({
  id: z.uuid(),
  teamId: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamSlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/, 'Slug must be lowercase kebab-case');

export const createTeamRequestSchema = z.object({
  name: z.string().min(1).max(100),
  slug: teamSlugSchema,
});

export const updateTeamRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: teamSlugSchema.optional(),
});

export const teamMemberRequestSchema = z.object({ userId: z.uuid() });
