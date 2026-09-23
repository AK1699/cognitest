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

export const MEMBER_STATUSES = ['active', 'suspended'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MemberStatus = {
  Active: 'active',
  Suspended: 'suspended',
} as const satisfies Record<string, MemberStatus>;

export const ONBOARDING_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export const OnboardingStatus = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
} as const satisfies Record<string, OnboardingStatus>;

export const PROJECT_STATUSES = ['active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const ProjectStatus = {
  Active: 'active',
  Archived: 'archived',
} as const satisfies Record<string, ProjectStatus>;

export const INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export const InvitationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Expired: 'expired',
  Revoked: 'revoked',
} as const satisfies Record<string, InvitationStatus>;

export const REQUIREMENT_STATUSES = ['draft', 'active', 'archived'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

// spec §53 lifecycle: Draft → Review → Approved (rejected drops back to draft);
// editing an approved plan bumps the version and returns it to draft
export const TEST_PLAN_STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const;
export type TestPlanStatus = (typeof TEST_PLAN_STATUSES)[number];
export const TestPlanStatus = {
  Draft: 'draft',
  InReview: 'in_review',
  Approved: 'approved',
  Archived: 'archived',
} as const satisfies Record<string, TestPlanStatus>;

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const TEST_CASE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TestCasePriority = (typeof TEST_CASE_PRIORITIES)[number];

export const OAUTH_PROVIDERS = ['google', 'microsoft'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export const OAuthProvider = {
  Google: 'google',
  Microsoft: 'microsoft',
} as const satisfies Record<string, OAuthProvider>;
