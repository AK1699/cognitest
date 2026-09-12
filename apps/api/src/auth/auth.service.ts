import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, or } from 'drizzle-orm';

import { UserStatus } from '@cognitest/shared';
import type { AuthUser } from '@cognitest/shared';

import type { OidcClaims } from './services/oidc.service';

import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../common/context/request-context.service';
import { DRIZZLE } from '../db/db.tokens';
import type { Database } from '../db/db.tokens';
import { oauthAccounts, users } from '../db/schema';
import { OrganizationsService } from '../organizations/organizations.service';
import type { SignupDto } from './dto/auth.dto';
import { CryptoService } from './services/crypto.service';
import { MailService } from './services/mail.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';

const AUTH_USER_COLUMNS = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  status: users.status,
  emailVerifiedAt: users.emailVerifiedAt,
  mfaEnabled: users.mfaEnabled,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly crypto: CryptoService,
    private readonly ctx: RequestContextService,
    private readonly audit: AuditService,
    private readonly organizations: OrganizationsService,
  ) {}

  /** Signup (spec §8): user → workspace bootstrap → verification mail → session. */
  async signup(input: SignupDto): Promise<{ user: AuthUser; rawToken: string }> {
    const passwordHash = await this.passwords.hash(input.password);

    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, input.email), eq(users.username, input.username)));
    if (existing.length > 0) {
      throw new ConflictException('Email or username is already in use');
    }

    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash,
        displayName: input.displayName,
        status: UserStatus.PendingVerification,
      })
      .returning(AUTH_USER_COLUMNS)
      .catch((error: unknown) => {
        // unique race with the pre-check above
        throw String(error).includes('duplicate key')
          ? new ConflictException('Email or username is already in use')
          : error;
      });
    if (!user) throw new Error('user insert returned no row');

    this.ctx.patch({ userId: user.id });
    try {
      await this.organizations.bootstrapOrganization(user.id, { name: input.organizationName });
    } catch (error) {
      await this.db.delete(users).where(eq(users.id, user.id));
      throw error;
    }

    await this.sendVerification(user.id, user.email);
    await this.audit.log({ action: 'USER_SIGNED_UP', resourceType: 'user', resourceId: user.id });

    const rawToken = await this.openSession(user.id);
    return { user, rawToken };
  }

  /** Uniform-timing login: unknown email burns a dummy argon2 verify. */
  async login(email: string, password: string): Promise<{ user: AuthUser; rawToken: string }> {
    const [user] = await this.db
      .select({ ...AUTH_USER_COLUMNS, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email));

    if (!user?.passwordHash) {
      await this.passwords.verifyDummy(password);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.Active && user.status !== UserStatus.PendingVerification) {
      throw new ForbiddenException('Account is not active');
    }

    this.ctx.patch({ userId: user.id });
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await this.audit.log({ action: 'USER_LOGIN', resourceType: 'user', resourceId: user.id });

    const rawToken = await this.openSession(user.id);
    const { passwordHash: _omitted, ...authUser } = user;
    return { user: authUser, rawToken };
  }

  async verifyEmail(rawToken: string): Promise<boolean> {
    const userId = await this.tokens.consume(rawToken, 'email_verification');
    if (!userId) return false;
    await this.db
      .update(users)
      .set({ emailVerifiedAt: new Date(), status: UserStatus.Active })
      .where(eq(users.id, userId));
    this.ctx.patch({ userId });
    await this.audit.log({ action: 'EMAIL_VERIFIED', resourceType: 'user', resourceId: userId });
    return true;
  }

  /** Always resolves — never reveals whether the address exists. */
  async resendVerification(email: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.email, email));
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerification(user.id, email);
  }

  /** Always resolves — never reveals whether the address exists. */
  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.email, email));
    if (!user || user.status === UserStatus.Deleted || user.status === UserStatus.Disabled) return;
    const { raw } = await this.tokens.issue(user.id, 'password_reset');
    await this.mail
      .sendPasswordResetEmail(email, raw)
      .catch((error: unknown) => this.logger.error({ err: error }, 'reset mail failed'));
  }

  async resetPassword(rawToken: string, password: string): Promise<boolean> {
    const userId = await this.tokens.consume(rawToken, 'password_reset');
    if (!userId) return false;
    const passwordHash = await this.passwords.hash(password);
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    const revoked = await this.sessions.revokeAllForUser(userId);
    this.ctx.patch({ userId });
    await this.audit.log({
      action: 'PASSWORD_RESET',
      resourceType: 'user',
      resourceId: userId,
      metadata: { revokedSessions: revoked },
    });
    return true;
  }

  /**
   * OIDC sign-in with the account-linking rules from the plan:
   * (provider, sub) match → login. Google with a provider-verified email may
   * auto-link to an existing account; Microsoft never auto-links by email
   * (nOAuth account-takeover class) → 'account_exists'. Otherwise a new user
   * is created (with a bootstrapped workspace, like password signup).
   */
  async oidcLogin(
    claims: OidcClaims,
  ): Promise<{ outcome: 'ok'; user: AuthUser; rawToken: string } | { outcome: 'account_exists' }> {
    const [linked] = await this.db
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, claims.provider),
          eq(oauthAccounts.providerAccountId, claims.sub),
        ),
      );

    let userId = linked?.userId ?? null;

    if (!userId && claims.email) {
      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, claims.email));
      if (existing) {
        const mayAutoLink = claims.provider === 'google' && claims.emailVerified;
        if (!mayAutoLink) return { outcome: 'account_exists' };
        await this.db.insert(oauthAccounts).values({
          userId: existing.id,
          provider: claims.provider,
          providerAccountId: claims.sub,
          emailAtProvider: claims.email,
        });
        this.ctx.patch({ userId: existing.id });
        await this.audit.log({
          action: 'OAUTH_ACCOUNT_LINKED',
          resourceType: 'user',
          resourceId: existing.id,
          metadata: { provider: claims.provider },
        });
        userId = existing.id;
      }
    }

    if (!userId) {
      if (!claims.email) throw new UnauthorizedException('Provider returned no email address');
      const verified = claims.provider === 'google' && claims.emailVerified;
      const displayName = claims.name ?? claims.email.split('@')[0] ?? 'New user';
      const [created] = await this.db
        .insert(users)
        .values({
          email: claims.email,
          displayName,
          avatarUrl: claims.picture,
          status: verified ? UserStatus.Active : UserStatus.PendingVerification,
          emailVerifiedAt: verified ? new Date() : null,
        })
        .returning({ id: users.id });
      if (!created) throw new Error('user insert returned no row');
      await this.db.insert(oauthAccounts).values({
        userId: created.id,
        provider: claims.provider,
        providerAccountId: claims.sub,
        emailAtProvider: claims.email,
      });
      this.ctx.patch({ userId: created.id });
      await this.organizations.bootstrapOrganization(created.id, {
        name: `${displayName}'s Workspace`,
      });
      if (!verified) await this.sendVerification(created.id, claims.email);
      await this.audit.log({
        action: 'USER_SIGNED_UP',
        resourceType: 'user',
        resourceId: created.id,
        metadata: { provider: claims.provider },
      });
      userId = created.id;
    }

    const [user] = await this.db
      .select({ ...AUTH_USER_COLUMNS })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException();
    if (user.status !== UserStatus.Active && user.status !== UserStatus.PendingVerification) {
      throw new ForbiddenException('Account is not active');
    }

    this.ctx.patch({ userId });
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
    await this.audit.log({
      action: 'USER_LOGIN',
      resourceType: 'user',
      resourceId: userId,
      metadata: { provider: claims.provider },
    });
    const rawToken = await this.openSession(userId);
    return { outcome: 'ok', user, rawToken };
  }

  private async sendVerification(userId: string, email: string): Promise<void> {
    const { raw } = await this.tokens.issue(userId, 'email_verification');
    // mail outage must not fail signup — the user can hit resend-verification
    await this.mail
      .sendVerificationEmail(email, raw)
      .catch((error: unknown) => this.logger.error({ err: error }, 'verification mail failed'));
  }

  private async openSession(userId: string): Promise<string> {
    const store = this.ctx.get();
    const { rawToken } = await this.sessions.create(userId, {
      ipHash: this.crypto.hashIp(store?.ip),
      userAgent: store?.userAgent ?? null,
    });
    return rawToken;
  }
}
