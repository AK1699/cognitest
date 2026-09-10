// Permission catalogue. Keys use the `resource:ACTION` format, e.g. `project:READ`.

export const RESOURCES = [
  'organization',
  'team',
  'user',
  'invitation',
  'project',
  'requirement',
  'test_plan',
  'test_suite',
  'test_case',
  'approval',
  'automation',
  'api_test',
  'performance_test',
  'security_test',
  'execution',
  'execution_agent',
  'integration',
  'impact_analysis',
  'audit_log',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  'READ',
  'CREATE',
  'UPDATE',
  'DELETE',
  'EXECUTE',
  'CANCEL',
  'APPROVE',
  'CONFIG',
] as const;
export type Action = (typeof ACTIONS)[number];

export type PermissionKey = `${Resource}:${Action}`;

const CRUD = ['READ', 'CREATE', 'UPDATE', 'DELETE'] as const satisfies readonly Action[];

/** Actions each resource supports. CRUD by default, with per-resource overrides. */
export const RESOURCE_ACTIONS: Record<Resource, readonly Action[]> = {
  organization: [...CRUD, 'CONFIG'],
  team: CRUD,
  user: CRUD,
  invitation: CRUD,
  project: CRUD,
  requirement: CRUD,
  test_plan: CRUD,
  test_suite: CRUD,
  test_case: CRUD,
  approval: [...CRUD, 'APPROVE'],
  automation: [...CRUD, 'CONFIG'],
  api_test: [...CRUD, 'CONFIG'],
  performance_test: [...CRUD, 'CONFIG'],
  security_test: [...CRUD, 'CONFIG'],
  execution: [...CRUD, 'EXECUTE', 'CANCEL'],
  execution_agent: [...CRUD, 'CONFIG'],
  integration: [...CRUD, 'CONFIG'],
  impact_analysis: CRUD,
  audit_log: ['READ'],
};

export const PERMISSION_KEYS: readonly PermissionKey[] = RESOURCES.flatMap((resource) =>
  RESOURCE_ACTIONS[resource].map((action): PermissionKey => `${resource}:${action}`),
);

export const SYSTEM_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** Test artefact resources members may create and update. */
const TEST_ARTEFACTS = [
  'project',
  'requirement',
  'test_plan',
  'test_suite',
  'test_case',
  'approval',
  'automation',
  'api_test',
  'performance_test',
  'security_test',
] as const satisfies readonly Resource[];

const ALL_READ = RESOURCES.map((r): PermissionKey => `${r}:READ`);

/**
 * Starter default permission matrix for the system roles. Not a finalised
 * product decision — revisit when the RBAC phase lands.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, readonly PermissionKey[]> = {
  owner: PERMISSION_KEYS,
  admin: PERMISSION_KEYS,
  member: [
    ...ALL_READ,
    ...TEST_ARTEFACTS.flatMap((r): PermissionKey[] => [`${r}:CREATE`, `${r}:UPDATE`]),
    'execution:EXECUTE',
    'execution:CANCEL',
  ],
  viewer: ALL_READ,
};
