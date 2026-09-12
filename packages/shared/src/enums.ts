// Enums as const objects (not TS enums) so values stay plain strings and the
// arrays can drive Drizzle pgEnum definitions without drift.

export const USER_STATUSES = [
  'pending_verification',
  'active',
  'suspended',
  'disabled',
  'deleted',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const UserStatus = {
  PendingVerification: 'pending_verification',
  Active: 'active',
  Suspended: 'suspended',
  Disabled: 'disabled',
  Deleted: 'deleted',
} as const satisfies Record<string, UserStatus>;

export const AUTH_TOKEN_TYPES = ['email_verification', 'password_reset'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];
export const AuthTokenType = {
  EmailVerification: 'email_verification',
  PasswordReset: 'password_reset',
} as const satisfies Record<string, AuthTokenType>;

export const ORG_STATUSES = ['active', 'suspended'] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];
export const OrgStatus = {
  Active: 'active',
  Suspended: 'suspended',
} as const satisfies Record<string, OrgStatus>;

export const OAUTH_PROVIDERS = ['google', 'microsoft'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export const OAuthProvider = {
  Google: 'google',
  Microsoft: 'microsoft',
} as const satisfies Record<string, OAuthProvider>;
