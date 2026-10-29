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

export const REQUIREMENT_PRIORITIES = ['low', 'medium', 'high'] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

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

// Test designs share the plan lifecycle (draft → in_review → approved; archived
// is the soft-delete terminal), plus a provenance marker for how it was created.
export const DESIGN_STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];
export const DesignStatus = {
  Draft: 'draft',
  InReview: 'in_review',
  Approved: 'approved',
  Archived: 'archived',
} as const satisfies Record<string, DesignStatus>;

export const DESIGN_SOURCES = ['manual', 'document', 'jira'] as const;
export type DesignSource = (typeof DESIGN_SOURCES)[number];
export const DesignSource = {
  Manual: 'manual',
  Document: 'document',
  Jira: 'jira',
} as const satisfies Record<string, DesignSource>;

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

// External delivery tools an organisation can connect (PAT/API-token auth).
export const INTEGRATION_PROVIDERS = ['jira', 'github', 'bitbucket', 'notion'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export const IntegrationProvider = {
  Jira: 'jira',
  GitHub: 'github',
  Bitbucket: 'bitbucket',
  Notion: 'notion',
} as const satisfies Record<string, IntegrationProvider>;

// A connection is healthy once its credentials verify; it flips to error when a
// later verify/sync fails (the credentials are still stored so the user can fix them).
export const INTEGRATION_STATUSES = ['connected', 'error'] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];
export const IntegrationStatus = {
  Connected: 'connected',
  Error: 'error',
} as const satisfies Record<string, IntegrationStatus>;

// ---------------------------------------------------------------------------
// Automation module — saved web-automation flows, their executable test cases,
// and run records. Execution itself is a later phase (desktop agents); runs are
// recorded here and, until the runtime lands, simulated deterministically.
// ---------------------------------------------------------------------------

// draft → active (ready to run) → disabled (retired but kept); archived is the
// soft-delete terminal, mirroring designs/plans.
export const AUTOMATION_STATUSES = ['draft', 'active', 'disabled', 'archived'] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];
export const AutomationStatus = {
  Draft: 'draft',
  Active: 'active',
  Disabled: 'disabled',
  Archived: 'archived',
} as const satisfies Record<string, AutomationStatus>;

// How an automation was authored (the "Create Automation" method picker).
export const AUTOMATION_METHODS = ['from_test_cases', 'visual', 'record', 'import'] as const;
export type AutomationMethod = (typeof AUTOMATION_METHODS)[number];
export const AutomationMethod = {
  FromTestCases: 'from_test_cases',
  Visual: 'visual',
  Record: 'record',
  Import: 'import',
} as const satisfies Record<string, AutomationMethod>;

// Underlying automation framework the generated code targets.
export const AUTOMATION_FRAMEWORKS = ['playwright', 'cypress', 'selenium', 'puppeteer'] as const;
export type AutomationFramework = (typeof AUTOMATION_FRAMEWORKS)[number];
export const AutomationFramework = {
  Playwright: 'playwright',
  Cypress: 'cypress',
  Selenium: 'selenium',
  Puppeteer: 'puppeteer',
} as const satisfies Record<string, AutomationFramework>;

// Lifecycle of a single run record.
export const AUTOMATION_RUN_STATUSES = [
  'queued',
  'running',
  'passed',
  'failed',
  'cancelled',
] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];
export const AutomationRunStatus = {
  Queued: 'queued',
  Running: 'running',
  Passed: 'passed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const satisfies Record<string, AutomationRunStatus>;

// Outcome of a single automated test — `not_run` until its first execution.
export const AUTOMATION_TEST_STATUSES = ['not_run', 'passed', 'failed', 'skipped'] as const;
export type AutomationTestStatus = (typeof AUTOMATION_TEST_STATUSES)[number];
export const AutomationTestStatus = {
  NotRun: 'not_run',
  Passed: 'passed',
  Failed: 'failed',
  Skipped: 'skipped',
} as const satisfies Record<string, AutomationTestStatus>;

// Product entities an external link may hang off (polymorphic — no FK).
export const EXTERNAL_LINK_ENTITY_TYPES = ['requirement', 'test_case', 'test_design'] as const;
export type ExternalLinkEntityType = (typeof EXTERNAL_LINK_ENTITY_TYPES)[number];
export const ExternalLinkEntityType = {
  Requirement: 'requirement',
  TestCase: 'test_case',
  TestDesign: 'test_design',
} as const satisfies Record<string, ExternalLinkEntityType>;
