import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';

import { UserStatus } from '@cognitest/shared';

import { RequestContextService } from '../../common/context/request-context.service';
import { IS_PUBLIC_METADATA } from '../../common/decorators/public.decorator';
import { DRIZZLE } from '../../db/db.tokens';
import type { Database } from '../../db/db.tokens';
import { users } from '../../db/schema';
import { SessionService } from '../services/session.service';

export const SESSION_COOKIE = 'cognitest_session';

/**
 * Global guard: resolves the session cookie into request.user/request.sessionId
 * and patches the request context. Routes marked @Public() pass through
 * (without user resolution — public routes must not rely on request.user).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly ctx: RequestContextService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_METADATA, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawToken = request.cookies?.[SESSION_COOKIE];
    if (!rawToken) throw new UnauthorizedException();

    const live = await this.sessions.validate(rawToken);
    if (!live) throw new UnauthorizedException();

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        mfaEnabled: users.mfaEnabled,
      })
      .from(users)
      .where(eq(users.id, live.userId));
    if (!user) throw new UnauthorizedException();

    // suspended/disabled/deleted users lose access immediately, sessions or not
    if (user.status !== UserStatus.Active && user.status !== UserStatus.PendingVerification) {
      throw new UnauthorizedException();
    }

    request.user = user;
    request.sessionId = live.sessionId;
    this.ctx.patch({ userId: user.id, sessionId: live.sessionId });
    return true;
  }
}
