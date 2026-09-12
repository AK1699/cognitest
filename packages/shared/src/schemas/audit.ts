import { z } from 'zod';

/** Security-sensitive events the audit trail records (architecture spec §38). */
export const AUDIT_ACTIONS = [
  // authentication
  'USER_SIGNED_UP',
  'USER_LOGIN',
  'USER_LOGOUT',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'EMAIL_VERIFIED',
  'SESSION_REVOKED',
  'OAUTH_ACCOUNT_LINKED',
  // organization governance
  'ORGANIZATION_CREATED',
  'ORGANIZATION_UPDATED',
  'ORGANIZATION_SUSPENDED',
  'MEMBER_INVITED',
  'MEMBER_ACCEPTED',
  'MEMBER_REMOVED',
  'MEMBER_ROLE_CHANGED',
  'INVITATION_REVOKED',
  'TEAM_CREATED',
  'TEAM_UPDATED',
  'TEAM_DELETED',
  'TEAM_MEMBER_ADDED',
  'TEAM_MEMBER_REMOVED',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_ARCHIVED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'PERMISSION_CHANGED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  actorUserId: z.uuid().nullable(),
  action: z.enum(AUDIT_ACTIONS),
  resourceType: z.string(),
  resourceId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  ipHash: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
