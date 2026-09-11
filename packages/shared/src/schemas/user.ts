import { z } from 'zod';

import { USER_STATUSES } from '../enums';

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  passwordHash: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.enum(USER_STATUSES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;
