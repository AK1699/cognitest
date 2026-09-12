import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { OAUTH_PROVIDERS } from '@cognitest/shared';
import type { OAuthProvider } from '@cognitest/shared';

import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env.schema';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './guards/auth.guard';
import { OidcService } from './services/oidc.service';
import { SessionService } from './services/session.service';

const MINUTE = 60_000;

function parseProvider(value: string): OAuthProvider {
  if ((OAUTH_PROVIDERS as readonly string[]).includes(value)) return value as OAuthProvider;
  throw new NotFoundException();
}

/** Only same-site relative paths may be used as post-login destinations. */
function safeRedirect(redirectTo: string | undefined): string {
  if (redirectTo?.startsWith('/') && !redirectTo.startsWith('//')) return redirectTo;
  return '/';
}

@Public()
@Throttle({ default: { ttl: MINUTE, limit: 20 } })
@Controller('auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);
  private readonly webOrigin: string;
  private readonly cookieSecure: boolean;

  constructor(
    private readonly oidc: OidcService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
    this.cookieSecure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Get(':provider/start')
  async start(
    @Param('provider') providerParam: string,
    @Query('redirectTo') redirectTo: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const provider = parseProvider(providerParam);
    const url = await this.oidc.start(provider, safeRedirect(redirectTo));
    await reply.redirect(url, 302);
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') providerParam: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const provider = parseProvider(providerParam);
    const fail = (error: string) =>
      reply.redirect(`${this.webOrigin}/login?error=${error}`, 302);

    const query = request.query as Record<string, string | undefined>;
    if (query.error) {
      await fail('oidc_denied');
      return;
    }

    try {
      // reconstruct the exact redirect_uri the provider called (via the web proxy)
      const callbackUrl = new URL(`/api${request.url}`, this.webOrigin);
      const result = await this.oidc.callback(provider, callbackUrl);
      if (!result) {
        await fail('oidc_failed');
        return;
      }

      const login = await this.auth.oidcLogin(result.claims);
      if (login.outcome === 'account_exists') {
        await fail('account_exists');
        return;
      }

      reply.setCookie(SESSION_COOKIE, login.rawToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cookieSecure,
        path: '/',
        maxAge: this.sessions.cookieMaxAge,
      });
      await reply.redirect(`${this.webOrigin}${result.redirectTo}`, 302);
    } catch (error) {
      this.logger.error({ err: error }, `${provider} OIDC callback failed`);
      await fail('oidc_failed');
    }
  }
}
