import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import type { PermissionKey } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authz/authorization.service';
import { isForeignKeyViolation, isUniqueViolation } from '../common/db-errors';
import { DRIZZLE } from '../db/db.tokens';
import type { Database } from '../db/db.tokens';
import { permissions, rolePermissions, roles } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class RbacService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
  ) {}

  /** System roles plus this organization's custom roles. */
  async listRoles(organizationId: string) {
    return this.tenantDb.run((tx) =>
      tx
        .select()
        .from(roles)
        .where(or(isNull(roles.organizationId), eq(roles.organizationId, organizationId))),
    );
  }

  /** The permission catalogue is global and public to any member. */
  async listPermissions() {
    return this.db
      .select({
        id: permissions.id,
        key: permissions.key,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(permissions);
  }

  async createRole(
    organizationId: string,
    input: { key: string; name: string; description?: string },
  ) {
    return this.tenantDb.run(async (tx) => {
      const [role] = await tx
        .insert(roles)
        .values({ organizationId, ...input, isSystem: false })
        .returning()
        .catch((error: unknown) => {
          throw isUniqueViolation(error)
            ? new ConflictException('A role with that key or name already exists')
            : error;
        });
      if (!role) throw new Error('role insert returned no row');
      await this.audit.log(
        { action: 'ROLE_CREATED', resourceType: 'role', resourceId: role.id },
        tx,
      );
      return role;
    });
  }

  async updateRole(
    organizationId: string,
    roleId: string,
    patch: { name?: string; description?: string | null },
  ) {
    return this.tenantDb.run(async (tx) => {
      // RLS already blocks system/foreign roles; the explicit filter documents it
      const [role] = await tx
        .update(roles)
        .set(patch)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, organizationId),
            eq(roles.isSystem, false),
          ),
        )
        .returning();
      if (!role) throw new NotFoundException();
      await this.audit.log(
        { action: 'ROLE_UPDATED', resourceType: 'role', resourceId: roleId },
        tx,
      );
      return role;
    });
  }

  async deleteRole(organizationId: string, roleId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const deleted = await tx
        .delete(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, organizationId),
            eq(roles.isSystem, false),
          ),
        )
        .returning({ id: roles.id })
        .catch((error: unknown) => {
          // organization_members.role_id FK: a role in use cannot be deleted
          throw isForeignKeyViolation(error)
            ? new ConflictException('Role is assigned to members — reassign them first')
            : error;
        });
      if (deleted.length === 0) throw new NotFoundException();
      await this.audit.log(
        { action: 'ROLE_DELETED', resourceType: 'role', resourceId: roleId },
        tx,
      );
    });
    await this.authz.invalidateRole(roleId);
  }

  /** Replaces a custom role's permission set (system roles are seed-managed). */
  async setRolePermissions(
    organizationId: string,
    roleId: string,
    permissionKeys: PermissionKey[],
  ): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, organizationId),
            eq(roles.isSystem, false),
          ),
        );
      if (!role) throw new NotFoundException();

      const rows =
        permissionKeys.length > 0
          ? await tx
              .select({ id: permissions.id, key: permissions.key })
              .from(permissions)
              .where(inArray(permissions.key, permissionKeys))
          : [];
      if (rows.length !== new Set(permissionKeys).size) {
        throw new BadRequestException('Unknown permission key');
      }

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (rows.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(rows.map((row) => ({ roleId, permissionId: row.id })));
      }
      await this.audit.log(
        {
          action: 'PERMISSION_CHANGED',
          resourceType: 'role',
          resourceId: roleId,
          metadata: { permissionKeys },
        },
        tx,
      );
    });
    await this.authz.invalidateRole(roleId);
  }
}
