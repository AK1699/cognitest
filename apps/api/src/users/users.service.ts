import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { organizationMembers, organizations, roles } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class UsersService {
  constructor(private readonly tenantDb: TenantDb) {}

  /**
   * Memberships with their organizations — runs pre-tenant (no org context);
   * RLS admits the rows via the app.user_id policy arms.
   */
  async listOrganizations(userId: string) {
    return this.tenantDb.runAsUser(userId, (tx) =>
      tx
        .select({
          membershipId: organizationMembers.id,
          roleId: organizationMembers.roleId,
          roleKey: roles.key,
          memberStatus: organizationMembers.status,
          joinedAt: organizationMembers.joinedAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            status: organizations.status,
            onboardingStatus: organizations.onboardingStatus,
            onboardingStep: organizations.onboardingStep,
          },
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .leftJoin(roles, eq(roles.id, organizationMembers.roleId))
        .where(eq(organizationMembers.userId, userId)),
    );
  }
}
