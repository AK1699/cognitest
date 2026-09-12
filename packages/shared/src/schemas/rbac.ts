import { z } from 'zod';

import { ACTIONS, PERMISSION_KEYS, RESOURCES, SYSTEM_ROLES } from '../permissions';
import type { PermissionKey } from '../permissions';

export const roleKeySchema = z.enum(SYSTEM_ROLES).or(z.string().regex(/^[a-z0-9_]{2,64}$/));

export const roleSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().nullable(),
  key: roleKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Role = z.infer<typeof roleSchema>;

export const permissionKeySchema = z
  .templateLiteral([z.enum(RESOURCES), '.', z.enum(ACTIONS)])
  .refine((key): key is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(key), {
    message: 'Unknown permission key',
  });

export const permissionSchema = z.object({
  id: z.uuid(),
  key: permissionKeySchema,
  resource: z.enum(RESOURCES),
  action: z.enum(ACTIONS),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const customRoleKeySchema = z
  .string()
  .regex(/^[a-z0-9_]{2,64}$/, 'Role key must be lowercase snake_case');

export const createRoleRequestSchema = z.object({
  key: customRoleKeySchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateRoleRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const setRolePermissionsRequestSchema = z.object({
  permissionKeys: z.array(permissionKeySchema).max(500),
});
