import { z } from 'zod';

import { ACTIONS, PERMISSION_KEYS, RESOURCES } from '../permissions';
import type { PermissionKey } from '../permissions';

export const roleSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Role = z.infer<typeof roleSchema>;

export const permissionKeySchema = z
  .templateLiteral([z.enum(RESOURCES), ':', z.enum(ACTIONS)])
  .refine((key): key is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(key), {
    message: 'Unknown permission key',
  });

export const permissionSchema = z.object({
  id: z.uuid(),
  key: permissionKeySchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Permission = z.infer<typeof permissionSchema>;
