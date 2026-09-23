import { z } from 'zod';

import { USER_STATUSES } from '../enums';

export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_-]{3,32}$/i, 'Username must be 3–32 letters, digits, _ or -');

/** Displayable password rules — the schema and the signup checklist share these. */
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'At least one uppercase letter (A–Z)', test: (value) => /[A-Z]/.test(value) },
  { label: 'At least one lowercase letter (a–z)', test: (value) => /[a-z]/.test(value) },
  { label: 'At least one number (0–9)', test: (value) => /[0-9]/.test(value) },
  { label: 'At least one special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export const passwordSchema = z
  .string()
  .max(128, 'Password must be at most 128 characters')
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({ code: 'custom', message: `Password must have: ${rule.label.toLowerCase()}` });
      }
    }
  });

/** Raw one-time tokens are 32 random bytes base64url-encoded → 43 chars. */
export const rawTokenSchema = z.string().length(43);

export const signupRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
  /** Optional — the web signup collects only email + password. */
  username: usernameSchema.optional(),
  password: passwordSchema,
  /** Optional — defaults to the email local part, as with OIDC signups. */
  displayName: z.string().min(1, 'Display name is required').max(100).optional(),
  /**
   * Optional one-shot workspace bootstrap (API convenience). The web signup
   * omits it — the onboarding wizard creates the organization instead.
   */
  organizationName: z.string().min(1).max(100).optional(),
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
