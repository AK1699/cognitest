import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authz/authorization.service';
import { isForeignKeyViolation, isUniqueViolation } from '../common/db-errors';
import { organizationMembers, teamMembers, teams } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

@Injectable()
export class TeamsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
  ) {}

  async list(organizationId: string) {
    return this.tenantDb.run((tx) =>
      tx.select().from(teams).where(eq(teams.organizationId, organizationId)),
    );
  }

  async create(organizationId: string, input: { name: string; slug: string }) {
    return this.tenantDb.run(async (tx) => {
      const [team] = await tx
        .insert(teams)
        .values({ organizationId, name: input.name, slug: input.slug })
        .returning()
        .catch((error: unknown) => {
          throw isUniqueViolation(error, 'teams_org_slug_uq')
            ? new ConflictException('A team with that slug already exists')
            : error;
        });
      if (!team) throw new Error('team insert returned no row');
      await this.audit.log(
        { action: 'TEAM_CREATED', resourceType: 'team', resourceId: team.id },
        tx,
      );
      return team;
    });
  }

  async update(teamId: string, patch: { name?: string; slug?: string }) {
    return this.tenantDb.run(async (tx) => {
      const [team] = await tx.update(teams).set(patch).where(eq(teams.id, teamId)).returning();
      if (!team) throw new NotFoundException();
      await this.audit.log(
        { action: 'TEAM_UPDATED', resourceType: 'team', resourceId: teamId },
        tx,
      );
      return team;
    });
  }

  async remove(teamId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const deleted = await tx
        .delete(teams)
        .where(eq(teams.id, teamId))
        .returning({ id: teams.id })
        .catch((error: unknown) => {
          // projects_team_org_fk is ON DELETE RESTRICT
          throw isForeignKeyViolation(error)
            ? new ConflictException('Move or delete this team’s projects first')
            : error;
        });
      if (deleted.length === 0) throw new NotFoundException();
      await this.audit.log(
        { action: 'TEAM_DELETED', resourceType: 'team', resourceId: teamId },
        tx,
      );
    });
  }

  async listMembers(teamId: string) {
    return this.tenantDb.run((tx) =>
      tx.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)),
    );
  }

  async addMember(organizationId: string, teamId: string, userId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [team] = await tx.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId));
      if (!team) throw new NotFoundException();
      const [member] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, userId),
          ),
        );
      if (!member) throw new BadRequestException('User is not a member of this organization');

      await tx.insert(teamMembers).values({ teamId, organizationId, userId }).onConflictDoNothing();
      await this.audit.log(
        {
          action: 'TEAM_MEMBER_ADDED',
          resourceType: 'team',
          resourceId: teamId,
          metadata: { userId },
        },
        tx,
      );
      await this.authz.invalidateTeams(organizationId, userId);
    });
  }

  async removeMember(organizationId: string, teamId: string, userId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const deleted = await tx
        .delete(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .returning({ id: teamMembers.id });
      if (deleted.length === 0) throw new NotFoundException();
      await this.audit.log(
        {
          action: 'TEAM_MEMBER_REMOVED',
          resourceType: 'team',
          resourceId: teamId,
          metadata: { userId },
        },
        tx,
      );
      await this.authz.invalidateTeams(organizationId, userId);
    });
  }
}
