import {
  createRoleRequestSchema,
  setRolePermissionsRequestSchema,
  updateRoleRequestSchema,
} from '@cognitest/shared';
import type { PermissionKey } from '@cognitest/shared';

export class CreateRoleDto {
  static readonly zodSchema = createRoleRequestSchema;
  key!: string;
  name!: string;
  description?: string;
}

export class UpdateRoleDto {
  static readonly zodSchema = updateRoleRequestSchema;
  name?: string;
  description?: string | null;
}

export class SetRolePermissionsDto {
  static readonly zodSchema = setRolePermissionsRequestSchema;
  permissionKeys!: PermissionKey[];
}
