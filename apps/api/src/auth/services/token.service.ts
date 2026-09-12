import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';

import type { AuthTokenType } from '@cognitest/shared';

import { DRIZZLE } from '../../db/db.tokens';
import type { Database } from '../../db/db.tokens';
import { authTokens } from '../../db/schema';
import { CryptoService } from './crypto.service';

const TOKEN_TTL_SECONDS: Record<AuthTokenType, number> = {
  email_verification: 24 * 60 * 60,
  password_reset: 60 * 60,
};

/**
 * Single-use auth tokens (email verification, password reset). Raw tokens
 * leave the process only inside emails; the DB stores sha256 hashes.
 */
@Injectable()
export class TokenService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
  ) {}

  /** Issues a fresh token, consuming any outstanding tokens of the same type. */
  async issue(userId: string, type: AuthTokenType): Promise<{ raw: string; expiresAt: Date }> {
    const raw = this.crypto.generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS[type] * 1000);
    await this.db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.type, type),
          isNull(authTokens.consumedAt),
        ),
      );
    await this.db
      .insert(authTokens)
      .values({ userId, type, tokenHash: this.crypto.sha256(raw), expiresAt });
    return { raw, expiresAt };
  }

  /** Consumes a raw token; returns the owning userId or null when invalid. */
  async consume(raw: string, type: AuthTokenType): Promise<string | null> {
    const [row] = await this.db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, this.crypto.sha256(raw)),
          eq(authTokens.type, type),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: authTokens.userId });
    return row?.userId ?? null;
  }
}
