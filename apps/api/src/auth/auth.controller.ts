import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { and, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthUser, MeResponse, SessionListItem } from '@cognitest/shared';

import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env.schema';
import { DRIZZLE } from '../db/db.tokens';
import type { Database } from '../db/db.tokens';
import { sessions } from '../db/schema';
import { AuthService } from './auth.service';
import { CurrentSession } from './decorators/current-session.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ForgotPasswordDto,
  LoginDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { SESSION_COOKIE } from './guards/auth.guard';
import { SessionService } from './services/session.service';

const MINUTE = 60_000;

@Controller('auth')
export class AuthController {
  private readonly cookieSecure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly sessionService: SessionService,
    @Inject(DRIZZLE) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSecure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private setSessionCookie(reply: FastifyReply, rawToken: string): void {
    reply.setCookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
      maxAge: this.sessionService.cookieMaxAge,
    });
  }

  private clearSessionCookie(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Public()
  @Throttle({ default: { ttl: MINUTE, limit: 5 } })
  @Post('signup')
  async signup(
    @Body() body: SignupDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ user: AuthUser }> {
    const { user, rawToken } = await this.auth.signup(body);
    this.setSessionCookie(reply, rawToken);
    return { user };
  }

  @Public()
  @Throttle({ default: { ttl: MINUTE, limit: 10 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ user: AuthUser }> {
    const { user, rawToken } = await this.auth.login(body.email, body.password);
    this.setSessionCookie(reply, rawToken);
    return { user };
  }

  @HttpCode(200)
  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ message: string }> {
    const rawToken = request.cookies?.[SESSION_COOKIE];
    if (rawToken) await this.sessionService.revokeByToken(rawToken);
    this.clearSessionCookie(reply);
    return { message: 'Logged out' };
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ message: string; revoked: number }> {
    const revoked = await this.sessionService.revokeAllForUser(user.id);
    this.clearSessionCookie(reply);
    return { message: 'All sessions revoked', revoked };
  }

  @Get('me')
  async me(
    @CurrentUser() user: AuthUser,
    @CurrentSession() sessionId: string,
  ): Promise<MeResponse> {
    const [session] = await this.db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    if (!session) throw new NotFoundException();
    return { user, session };
  }

  @Get('sessions')
  async listSessions(
    @CurrentUser() user: AuthUser,
    @CurrentSession() sessionId: string,
  ): Promise<{ sessions: SessionListItem[] }> {
    return { sessions: await this.sessionService.listForUser(user.id, sessionId) };
  }

  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const revoked = await this.sessionService.revokeById(user.id, id);
    if (!revoked) throw new NotFoundException();
    return { message: 'Session revoked' };
  }

  @Public()
  @Throttle({ default: { ttl: MINUTE, limit: 10 } })
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<{ message: string }> {
    if (!(await this.auth.verifyEmail(body.token))) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    return { message: 'Email verified' };
  }

  @Public()
  @Throttle({ default: { ttl: MINUTE, limit: 3 } })
  @HttpCode(200)
  @Post('resend-verification')
  async resendVerification(@Body() body: ResendVerificationDto): Promise<{ message: string }> {
    await this.auth.resendVerification(body.email);
    return { message: 'If that address exists and is unverified, a new email is on its way' };
  }

  @Public()
  @Throttle({ default: { ttl: MINUTE, limit: 3 } })
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.forgotPassword(body.email);
    return { message: 'If that address exists, a reset email is on its way' };
  }

  @Public()
  @Throttle({ default: { ttl: MINUTE, limit: 5 } })
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto): Promise<{ message: string }> {
    if (!(await this.auth.resetPassword(body.token, body.password))) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    return { message: 'Password reset — log in with your new password' };
  }
}
