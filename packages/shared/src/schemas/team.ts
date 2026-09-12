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
