import { z } from 'zod';

import { USER_STATUSES } from '../enums';

/** Full row shape — internal to the API. Never return this from a controller. */
export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string().nullable(),
  passwordHash: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.enum(USER_STATUSES),
  emailVerifiedAt: z.coerce.date().nullable(),
  mfaEnabled: z.boolean(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;
