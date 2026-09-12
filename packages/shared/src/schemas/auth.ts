import { z } from 'zod';

import { USER_STATUSES } from '../enums';

export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_-]{3,32}$/i, 'Username must be 3–32 letters, digits, _ or -');

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

/** Raw one-time tokens are 32 random bytes base64url-encoded → 43 chars. */
export const rawTokenSchema = z.string().length(43);

export const signupRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().min(1, 'Display name is required').max(100),
  /** Workspace to bootstrap (spec §8); the slug is generated server-side. */
  organizationName: z.string().min(1, 'Workspace name is required').max(100),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const verifyEmailRequestSchema = z.object({ token: rawTokenSchema });
export const resendVerificationRequestSchema = z.object({ email: z.email() });
export const forgotPasswordRequestSchema = z.object({ email: z.email() });
export const resetPasswordRequestSchema = z.object({
  token: rawTokenSchema,
  password: passwordSchema,
});

/** Public projection of a user — the only user shape controllers may return. */
export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.enum(USER_STATUSES),
  emailVerifiedAt: z.coerce.date().nullable(),
  mfaEnabled: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const meResponseSchema = z.object({
  user: authUserSchema,
  session: z.object({
    id: z.uuid(),
    createdAt: z.coerce.date(),
    lastSeenAt: z.coerce.date().nullable(),
    expiresAt: z.coerce.date(),
  }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const sessionListItemSchema = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  createdAt: z.coerce.date(),
  lastSeenAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date(),
  current: z.boolean(),
});
export type SessionListItem = z.infer<typeof sessionListItemSchema>;

/** Generic response for endpoints that must not reveal account existence. */
export const authMessageResponseSchema = z.object({ message: z.string() });
