import { z } from 'zod';

export const sessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  tokenHash: z.string(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  expiresAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Session = z.infer<typeof sessionSchema>;
