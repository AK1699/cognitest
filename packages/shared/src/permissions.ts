// Permission catalogue. Keys use the `resource.action` format, e.g. `test_plan.approve`.
// Lowercase on both sides — one canonical representation everywhere (DB, guards, UI).

export const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'configure',
  'execute',
  'cancel',
  'approve',
] as const;
export type Action = (typeof ACTIONS)[number];

/** Governance resources: org administration, gated by explicit per-role grants. */
export const GOVERNANCE_RESOURCES = [
  'organization',
  'member',
  'invitation',
  'team',
  'role',
  'audit_log',
] as const;

/** Product resources: test artefacts, gated mechanically by the role/action matrix. */
export const PRODUCT_RESOURCES = [
  'project',
  'requirement',
  'test_plan',
  'test_suite',
  'test_case',
  'automation',
  'api',
  'performance',
  'security',
  'integration',
  'agent',
] as const;

export const RESOURCES = [...GOVERNANCE_RESOURCES, ...PRODUCT_RESOURCES] as const;
export type Resource = (typeof RESOURCES)[number];

export type PermissionKey = `${Resource}.${Action}`;

const CRUD = ['read', 'create', 'update', 'delete'] as const satisfies readonly Action[];
const RUNNABLE = [...CRUD, 'configure', 'execute', 'cancel'] as const satisfies readonly Action[];

/** Actions each resource supports. */
export const RESOURCE_ACTIONS: Record<Resource, readonly Action[]> = {
  organization: ['read', 'update', 'delete', 'configure'],
  member: ['read', 'update', 'delete'],
  invitation: ['read', 'create', 'delete'],
  team: CRUD,
  role: CRUD,
  audit_log: ['read'],
  project: [...CRUD, 'configure'],
  requirement: CRUD,
  test_plan: [...CRUD, 'approve', 'execute'],
  test_suite: CRUD,
  test_case: CRUD,
  automation: RUNNABLE,
  api: RUNNABLE,
  performance: RUNNABLE,
  security: RUNNABLE,
  integration: [...CRUD, 'configure'],
  agent: [...CRUD, 'configure'],
};

export const PERMISSION_KEYS: readonly PermissionKey[] = RESOURCES.flatMap((resource) =>
  RESOURCE_ACTIONS[resource].map((action): PermissionKey => `${resource}.${action}`),
);

export function permissionKey(resource: Resource, action: Action): PermissionKey {
  return `${resource}.${action}`;
}

export const SYSTEM_ROLES = [
  'admin',
  'manager',
  'tester',
  'business_analyst',
  'developer',
  'viewer',
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const SYSTEM_ROLE_NAMES: Record<SystemRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  tester: 'Tester',
  business_analyst: 'Business Analyst',
  developer: 'Developer',
  viewer: 'Viewer',
};

export const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  admin: 'Full access to everything in the organization',
  manager: 'Manages teams, projects and test delivery; cannot delete or administer members',
  tester: 'Creates, configures and executes tests',
  business_analyst: 'Authors requirements and test plans; approves test plans',
  developer: 'Works on test artefacts and runs executions',
  viewer: 'Read-only access',
};

/**
 * Product-resource action matrix (architecture spec §25). Applied mechanically
 * to every product resource, intersected with the actions it supports.
 */
const PRODUCT_ROLE_ACTIONS: Record<SystemRole, readonly Action[]> = {
  admin: ACTIONS,
  manager: ['read', 'create', 'update', 'configure', 'execute', 'cancel', 'approve'],
  tester: ['read', 'create', 'update', 'configure', 'execute', 'cancel'],
  business_analyst: ['read', 'create', 'update', 'configure', 'approve'],
  developer: ['read', 'create', 'update', 'execute', 'cancel'],
  viewer: ['read'],
};

/**
 * Governance grants are explicit, not matrix-derived: a manager may run test
 * delivery without being able to change members, roles or the organization.
 */
const GOVERNANCE_ROLE_GRANTS: Record<Exclude<SystemRole, 'admin'>, readonly PermissionKey[]> = {
  manager: [
    'organization.read',
    'member.read',
    'team.read',
    'team.create',
    'team.update',
    'invitation.read',
    'invitation.create',
    'role.read',
    'audit_log.read',
  ],
  tester: ['organization.read', 'member.read', 'team.read'],
  business_analyst: ['organization.read', 'member.read', 'team.read'],
  developer: ['organization.read', 'member.read', 'team.read'],
  viewer: ['organization.read', 'member.read', 'team.read'],
};

function productKeysFor(role: SystemRole): PermissionKey[] {
  const allowed = new Set(PRODUCT_ROLE_ACTIONS[role]);
  return PRODUCT_RESOURCES.flatMap((resource) =>
    RESOURCE_ACTIONS[resource]
      .filter((action) => allowed.has(action))
      .map((action): PermissionKey => `${resource}.${action}`),
  );
}

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, readonly PermissionKey[]> = {
  admin: PERMISSION_KEYS,
  manager: [...GOVERNANCE_ROLE_GRANTS.manager, ...productKeysFor('manager')],
  tester: [...GOVERNANCE_ROLE_GRANTS.tester, ...productKeysFor('tester')],
  business_analyst: [
    ...GOVERNANCE_ROLE_GRANTS.business_analyst,
    ...productKeysFor('business_analyst'),
  ],
  developer: [...GOVERNANCE_ROLE_GRANTS.developer, ...productKeysFor('developer')],
  viewer: [...GOVERNANCE_ROLE_GRANTS.viewer, ...productKeysFor('viewer')],
};

/** Splits a permission key back into its resource/action parts. */
export function parsePermissionKey(key: PermissionKey): { resource: Resource; action: Action } {
  const separator = key.lastIndexOf('.');
  return {
    resource: key.slice(0, separator) as Resource,
    action: key.slice(separator + 1) as Action,
  };
}
