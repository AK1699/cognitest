import { z } from 'zod';

import { PROJECT_STATUSES } from '../enums';

export const projectKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Project key must be 2–10 uppercase letters/digits');

export const projectSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  key: projectKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(PROJECT_STATUSES),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectMemberSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;
