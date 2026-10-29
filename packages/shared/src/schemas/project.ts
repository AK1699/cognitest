import { z } from 'zod';

import { PROJECT_STATUSES } from '../enums';

export const projectKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Project key must be 2–10 uppercase letters/digits');

export const projectSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  teamId: z.uuid().nullable(),
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

export const createProjectRequestSchema = z.object({
  /** Omitted → derived from the name server-side. */
  key: projectKeySchema.optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  /** Optional owning team (Jira model) — omitted means no team. */
  teamId: z.uuid().optional(),
});

export const updateProjectRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  /** null unassigns the team. */
  teamId: z.uuid().nullable().optional(),
});

export const projectMemberRequestSchema = z.object({ userId: z.uuid() });
