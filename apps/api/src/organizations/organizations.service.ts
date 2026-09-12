import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { Organization } from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../common/context/request-context.service';
import { DRIZZLE } from '../db/db.tokens';
import type { Database } from '../db/db.tokens';
import { organizationMembers, organizations, roles, teamMembers, teams } from '../db/schema';
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
  ) {}

  /**
   * Transactional signup bootstrap (spec §8–9): organization → admin
   * membership → default team → team membership → audit event. The org UUID is
   * generated app-side and SET LOCAL'd before the insert so RLS admits it.
   */
  async bootstrapOrganization(
    userId: string,
    input: { name: string; slug?: string },
  ): Promise<Organization> {
    const organizationId = randomUUID();
    const slug = input.slug ?? (await this.availableSlug(slugify(input.name)));

    const [adminRole] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, 'admin'));
    if (!adminRole) throw new Error('system roles missing — run the seed');

    return this.ctx.run({ organizationId, userId, ...this.carryHttpMeta() }, () =>
      this.tenantDb.run(async (tx) => {
        const [organization] = await tx
          .insert(organizations)
          .values({ id: organizationId, name: input.name, slug, onboardingStatus: 'in_progress' })
          .returning();
        if (!organization) throw new Error('organization insert returned no row');

        await tx
          .insert(organizationMembers)
          .values({ organizationId, userId, roleId: adminRole.id });

        const [team] = await tx
          .insert(teams)
          .values({ organizationId, name: 'General', slug: 'general' })
          .returning({ id: teams.id });
        if (!team) throw new Error('team insert returned no row');
        await tx.insert(teamMembers).values({ teamId: team.id, organizationId, userId });

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

  /** Appends a short random suffix on slug collision. */
  private async availableSlug(base: string): Promise<string> {
    const [taken] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, base));
    if (!taken) return base;
    const suffixed = `${base.slice(0, SLUG_MAX - 7)}-${randomUUID().slice(0, 6)}`;
    const [stillTaken] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, suffixed));
    if (stillTaken) throw new ConflictException('Could not allocate a unique slug');
    return suffixed;
  }

  /** Keeps ip/userAgent when re-rooting the context for the bootstrap tx. */
  private carryHttpMeta(): { ip?: string; userAgent?: string } {
    const store = this.ctx.get();
    return { ip: store?.ip, userAgent: store?.userAgent };
  }
}
