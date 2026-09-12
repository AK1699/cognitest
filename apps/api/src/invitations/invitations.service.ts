import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authz/authorization.service';
import { CryptoService } from '../auth/services/crypto.service';
import { MailService } from '../auth/services/mail.service';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/db.tokens';
import type { Database } from '../db/db.tokens';
import { RequestContextService } from '../common/context/request-context.service';
import { isUniqueViolation } from '../common/db-errors';
import {
  invitations,
  organizationMembers,
  organizations,
  roles,
  teamMembers,
  teams,
} from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenantDb: TenantDb,
    private readonly ctx: RequestContextService,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
  ) {}

  async list(organizationId: string) {
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: invitations.id,
          email: invitations.email,
          roleId: invitations.roleId,
          teamId: invitations.teamId,
          status: invitations.status,
          invitedBy: invitations.invitedBy,
          expiresAt: invitations.expiresAt,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .where(eq(invitations.organizationId, organizationId)),
    );
  }

  async create(
    organizationId: string,
    invitedBy: string,
    input: { email: string; roleId: string; teamId?: string },
  ) {
    const raw = this.crypto.generateToken();

    const created = await this.tenantDb.run(async (tx) => {
      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.id, input.roleId),
            or(isNull(roles.organizationId), eq(roles.organizationId, organizationId)),
          ),
        );
      if (!role) throw new BadRequestException('Unknown role');

      if (input.teamId) {
        const [team] = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.id, input.teamId));
        if (!team) throw new BadRequestException('Unknown team');
      }

      const [invitation] = await tx
        .insert(invitations)
        .values({
          organizationId,
          email: input.email,
          roleId: input.roleId,
          teamId: input.teamId,
          tokenHash: this.crypto.sha256(raw),
          invitedBy,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        })
        .returning()
        .catch((error: unknown) => {
          throw isUniqueViolation(error, 'invitations_org_email_pending_uq')
            ? new ConflictException('A pending invitation for this address already exists')
            : error;
        });
      if (!invitation) throw new Error('invitation insert returned no row');

      await this.audit.log(
        {
          action: 'MEMBER_INVITED',
          resourceType: 'invitation',
          resourceId: invitation.id,
          metadata: { email: input.email },
        },
        tx,
      );
      return invitation;
    });

    const [organization] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    await this.mail
      .sendInvitationEmail(input.email, raw, organization?.name ?? 'a Cognitest workspace')
      .catch(() => undefined); // mail outage: the invite can be revoked and re-sent

    return created;
  }

  async revoke(organizationId: string, invitationId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(invitations)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(invitations.id, invitationId),
            eq(invitations.organizationId, organizationId),
            eq(invitations.status, 'pending'),
          ),
        )
        .returning({ id: invitations.id });
      if (updated.length === 0) throw new NotFoundException();
      await this.audit.log(
        { action: 'INVITATION_REVOKED', resourceType: 'invitation', resourceId: invitationId },
        tx,
      );
    });
  }

  /**
   * Accepts an invitation for the logged-in user. Runs outside TenantGuard —
   * the invitation itself is the authorization, so the tenant context is
   * established server-side from its organization_id.
   */
  async accept(user: { id: string; email: string }, rawToken: string) {
    // token lookup crosses tenants by design; the global client is RLS-bound,
    // so resolve the invitation as the owner of the token via its hash
    const tokenHash = this.crypto.sha256(rawToken);

    return this.ctx.run({ userId: user.id, ...this.httpMeta() }, async () => {
      const organizationId = await this.resolveInvitationOrg(tokenHash);
      if (!organizationId) throw new BadRequestException('Invalid or expired invitation');

      this.ctx.patch({ organizationId });
      return this.tenantDb.run(async (tx) => {
        const [invitation] = await tx
          .select()
          .from(invitations)
          .where(and(eq(invitations.tokenHash, tokenHash), eq(invitations.status, 'pending')));
        if (!invitation || invitation.expiresAt.getTime() < Date.now()) {
          throw new BadRequestException('Invalid or expired invitation');
        }
        if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new ForbiddenException('This invitation was issued to a different email address');
        }

        const [existing] = await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, invitation.organizationId),
              eq(organizationMembers.userId, user.id),
            ),
          );
        if (existing) throw new ConflictException('Already a member of this organization');

        await tx.insert(organizationMembers).values({
          organizationId: invitation.organizationId,
          userId: user.id,
          roleId: invitation.roleId,
        });
        if (invitation.teamId) {
          await tx.insert(teamMembers).values({
            teamId: invitation.teamId,
            organizationId: invitation.organizationId,
            userId: user.id,
          });
        }
        await tx
          .update(invitations)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eq(invitations.id, invitation.id));
        await this.audit.log(
          {
            action: 'MEMBER_ACCEPTED',
            resourceType: 'invitation',
            resourceId: invitation.id,
            organizationId: invitation.organizationId,
          },
          tx,
        );
        await this.authz.invalidateMember(invitation.organizationId, user.id);
        return { organizationId: invitation.organizationId };
      });
    });
  }

  /**
   * Token-hash → organization via the SECURITY DEFINER resolver — the one
   * deliberate RLS bypass (the invitation itself is the authorization).
   */
  private async resolveInvitationOrg(tokenHash: string): Promise<string | null> {
    const rows = await this.db.execute<{ organization_id: string | null }>(
      sql`select app_resolve_invitation(${tokenHash}) as organization_id`,
    );
    return rows[0]?.organization_id ?? null;
  }

  private httpMeta(): { ip?: string; userAgent?: string } {
    const store = this.ctx.get();
    return { ip: store?.ip, userAgent: store?.userAgent };
  }
}
