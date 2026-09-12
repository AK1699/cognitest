import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import * as oidc from 'openid-client';

import type { OAuthProvider } from '@cognitest/shared';

import type { Env } from '../../config/env.schema';
import { REDIS } from '../../redis/redis.module';
import { CryptoService } from './crypto.service';

export interface OidcClaims {
  provider: OAuthProvider;
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

interface StatePayload {
  provider: OAuthProvider;
  codeVerifier: string;
  nonce: string;
  redirectTo: string;
}

const STATE_TTL_SECONDS = 600;

/**
 * Authorization-code + PKCE against Google and Microsoft. Discovery runs
 * lazily per provider and is cached; providers without credentials are
 * disabled so dev/CI boots credential-less. No offline scopes are requested —
 * provider tokens are discarded after the claims read.
 *
 * Microsoft note: multi-tenant ('common') apps return per-tenant issuers that
 * openid-client's strict validation rejects; configure a concrete
 * MICROSOFT_TENANT for now (multi-tenant support is a flagged follow-up).
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private readonly configs = new Map<OAuthProvider, Promise<oidc.Configuration>>();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly crypto: CryptoService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  isEnabled(provider: OAuthProvider): boolean {
    return Boolean(this.clientCredentials(provider));
  }

  private clientCredentials(provider: OAuthProvider): { id: string; secret: string } | null {
    const id =
      provider === 'google'
        ? this.config.get('GOOGLE_CLIENT_ID', { infer: true })
        : this.config.get('MICROSOFT_CLIENT_ID', { infer: true });
    const secret =
      provider === 'google'
        ? this.config.get('GOOGLE_CLIENT_SECRET', { infer: true })
        : this.config.get('MICROSOFT_CLIENT_SECRET', { infer: true });
    return id && secret ? { id, secret } : null;
  }

  private issuerUrl(provider: OAuthProvider): URL {
    if (provider === 'google') return new URL('https://accounts.google.com');
    const tenant = this.config.get('MICROSOFT_TENANT', { infer: true });
    return new URL(`https://login.microsoftonline.com/${tenant}/v2.0`);
  }

  private getConfiguration(provider: OAuthProvider): Promise<oidc.Configuration> {
    const credentials = this.clientCredentials(provider);
    if (!credentials) {
      throw new ServiceUnavailableException(`${provider} sign-in is not configured`);
    }
    let cached = this.configs.get(provider);
    if (!cached) {
      cached = oidc.discovery(this.issuerUrl(provider), credentials.id, credentials.secret);
      cached.catch((error: unknown) => {
        this.configs.delete(provider); // retry discovery on the next attempt
        this.logger.error({ err: error }, `${provider} OIDC discovery failed`);
      });
      this.configs.set(provider, cached);
    }
    return cached;
  }

  redirectUri(provider: OAuthProvider): string {
    // via the Next proxy so the session cookie lands on the web origin
    return `${this.config.get('WEB_ORIGIN', { infer: true })}/api/auth/oidc/${provider}/callback`;
  }

  /** Builds the provider redirect and stashes state+PKCE in Redis. */
  async start(provider: OAuthProvider, redirectTo: string): Promise<string> {
    const configuration = await this.getConfiguration(provider);
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();

    const payload: StatePayload = { provider, codeVerifier, nonce, redirectTo };
    await this.redis.set(
      `oidc:state:${this.crypto.sha256(state)}`,
      JSON.stringify(payload),
      'EX',
      STATE_TTL_SECONDS,
    );

    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri(provider),
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return url.href;
  }

  /** Validates the callback (state, PKCE, nonce, signature) and returns claims. */
  async callback(
    provider: OAuthProvider,
    callbackUrl: URL,
  ): Promise<{ claims: OidcClaims; redirectTo: string } | null> {
    const state = callbackUrl.searchParams.get('state');
    if (!state) return null;

    const stateKey = `oidc:state:${this.crypto.sha256(state)}`;
    const rawPayload = await this.redis.get(stateKey);
    if (!rawPayload) return null;
    await this.redis.del(stateKey); // single-use
    const payload = JSON.parse(rawPayload) as StatePayload;
    if (payload.provider !== provider) return null;

    const configuration = await this.getConfiguration(provider);
    const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
      pkceCodeVerifier: payload.codeVerifier,
      expectedNonce: payload.nonce,
      expectedState: state,
    });
    const claims = tokens.claims();
    if (!claims?.sub) return null;

    return {
      claims: {
        provider,
        sub: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : null,
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === 'string' ? claims.name : null,
        picture: typeof claims.picture === 'string' ? claims.picture : null,
      },
      redirectTo: payload.redirectTo,
    };
  }
}
