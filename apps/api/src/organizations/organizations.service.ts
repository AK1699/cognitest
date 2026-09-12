import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { Organization } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authz/authorization.service';
import { RequestContextService } from '../common/context/request-context.service';
import { isUniqueViolation } from '../common/db-errors';
import { DRIZZLE } from '../db/db.tokens';
import type { Database } from '../db/db.tokens';
import { organizationMembers, organizations, roles, teamMembers, teams, users } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

const SLUG_MAX = 48;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX - 7);
  return base.length >= 3 ? base : `org-${base}`;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenantDb: TenantDb,
    private readonly ctx: RequestContextService,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
  ) {}

  async get(organizationId: string): Promise<Organization> {
    const [organization] = await this.tenantDb.run((tx) =>
      tx.select().from(organizations).where(eq(organizations.id, organizationId)),
    );
    if (!organization) throw new NotFoundException();
    return organization as Organization;
  }

  async update(
    organizationId: string,
    patch: { name?: string; onboardingStatus?: Organization['onboardingStatus']; onboardingStep?: string | null },
  ): Promise<Organization> {
    const values: Record<string, unknown> = { ...patch };
    if (patch.onboardingStatus === 'completed') values.onboardingCompletedAt = new Date();
    const [organization] = await this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(organizations)
        .set(values)
        .where(eq(organizations.id, organizationId))
        .returning();
      await this.audit.log(
        { action: 'ORGANIZATION_UPDATED', resourceType: 'organization', resourceId: organizationId },
        tx,
      );
      return updated;
    });
    if (!organization) throw new NotFoundException();
    return organization as Organization;
  }

  /** Soft delete: the organization is suspended, data is preserved (spec §69). */
  async suspend(organizationId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(organizations)
        .set({ status: 'suspended' })
        .where(eq(organizations.id, organizationId))
        .returning({ id: organizations.id });
      if (updated.length === 0) throw new NotFoundException();
      await this.audit.log(
        { action: 'ORGANIZATION_SUSPENDED', resourceType: 'organization', resourceId: organizationId },
        tx,
      );
    });
  }

  async listMembers(organizationId: string) {
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          roleId: organizationMembers.roleId,
          roleKey: roles.key,
          status: organizationMembers.status,
          joinedAt: organizationMembers.joinedAt,
          email: users.email,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .leftJoin(roles, eq(roles.id, organizationMembers.roleId))
        .where(eq(organizationMembers.organizationId, organizationId)),
    );
  }

  async changeMemberRole(organizationId: string, memberId: string, roleId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [member] = await tx
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberId));
      if (!member) throw new NotFoundException();

      const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId));
      if (!role) throw new BadRequestException('Unknown role');

      await this.assertNotLastAdmin(tx, organizationId, memberId);
      await tx
        .update(organizationMembers)
        .set({ roleId })
        .where(eq(organizationMembers.id, memberId));
      await this.audit.log(
        {
          action: 'MEMBER_ROLE_CHANGED',
          resourceType: 'organization_member',
          resourceId: memberId,
          metadata: { roleId },
        },
        tx,
      );
      await this.authz.invalidateMember(organizationId, member.userId);
    });
  }

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [member] = await tx
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberId));
      if (!member) throw new NotFoundException();

      await this.assertNotLastAdmin(tx, organizationId, memberId);
      await tx.delete(teamMembers).where(eq(teamMembers.userId, member.userId));
      await tx.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
      await this.audit.log(
        { action: 'MEMBER_REMOVED', resourceType: 'organization_member', resourceId: memberId },
        tx,
      );
      await this.authz.invalidateMember(organizationId, member.userId);
    });
  }

  /** Blocks removing or downgrading the only admin of an organization. */
  private async assertNotLastAdmin(
    tx: Database,
    organizationId: string,
    targetMemberId: string,
  ): Promise<void> {
    const admins = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .innerJoin(roles, eq(roles.id, organizationMembers.roleId))
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(roles.key, 'admin'),
          eq(roles.isSystem, true),
        ),
      );
    if (admins.length === 1 && admins[0]?.id === targetMemberId) {
      throw new BadRequestException('An organization must keep at least one admin');
    }
  }

  /**
   * Transactional bootstrap (spec §8–9): organization → admin membership →
   * default team → team membership → audit event. The org UUID is generated
   * app-side and SET LOCAL'd before the insert so RLS admits it.
   * `defaultTeam: false` skips team creation — the onboarding wizard creates
   * a named team itself in step 2 (tracked via onboarding_step).
   */
  async bootstrapOrganization(
    userId: string,
    input: { name: string; slug?: string; defaultTeam?: boolean },
  ): Promise<Organization> {
    const base = input.slug ?? slugify(input.name);
    // slug availability cannot be pre-checked: the app role's RLS view hides
    // other tenants' organizations. Try the base slug; on a unique violation
    // the whole transaction rolled back, so retry once with a random suffix.
    try {
      return await this.bootstrapWithSlug(userId, input, base);
    } catch (error) {
      if (!isUniqueViolation(error, 'organizations_slug_unique')) throw error;
      if (input.slug) throw new ConflictException('An organization with that slug already exists');
      const suffixed = `${base.slice(0, SLUG_MAX - 7)}-${randomUUID().slice(0, 6)}`;
      return this.bootstrapWithSlug(userId, input, suffixed);
    }
  }

  private async bootstrapWithSlug(
    userId: string,
    input: { name: string; defaultTeam?: boolean },
    slug: string,
  ): Promise<Organization> {
    const organizationId = randomUUID();
    const withDefaultTeam = input.defaultTeam !== false;

    const [adminRole] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, 'admin'));
    if (!adminRole) throw new Error('system roles missing — run the seed');

    return this.ctx.run({ organizationId, userId, ...this.carryHttpMeta() }, () =>
      this.tenantDb.run(async (tx) => {
        const [organization] = await tx
          .insert(organizations)
          .values({
            id: organizationId,
            name: input.name,
            slug,
            onboardingStatus: 'in_progress',
            // wizard resume point: next step is team creation or invitations
            onboardingStep: withDefaultTeam ? 'invite' : 'team',
          })
          .returning();
        if (!organization) throw new Error('organization insert returned no row');

        await tx
          .insert(organizationMembers)
          .values({ organizationId, userId, roleId: adminRole.id });

        if (withDefaultTeam) {
          const [team] = await tx
            .insert(teams)
            .values({ organizationId, name: 'General', slug: 'general' })
            .returning({ id: teams.id });
          if (!team) throw new Error('team insert returned no row');
          await tx.insert(teamMembers).values({ teamId: team.id, organizationId, userId });
        }

        await this.audit.log(
          {
            action: 'ORGANIZATION_CREATED',
            resourceType: 'organization',
            resourceId: organizationId,
            organizationId,
          },
          tx,
        );
        return organization as Organization;
      }),
    );
  }


  /** Keeps ip/userAgent when re-rooting the context for the bootstrap tx. */
  private carryHttpMeta(): { ip?: string; userAgent?: string } {
    const store = this.ctx.get();
    return { ip: store?.ip, userAgent: store?.userAgent };
  }
}
