import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema';

/**
 * All at-rest crypto, keyed by HKDF subkeys of AUTH_SECRET — one secret to
 * rotate. sha256 for token hashes (tokens are already 256-bit random, so a
 * plain hash is enough), HMAC for IP pseudonymisation, AES-256-GCM for
 * provider tokens (schema-ready, unused while no offline scopes are requested).
 */
@Injectable()
export class CryptoService {
  private readonly ipKey: Buffer;
  private readonly encKey: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const secret = config.get('AUTH_SECRET', { infer: true });
    this.ipKey = this.derive(secret, 'cognitest/ip-hash');
    this.encKey = this.derive(secret, 'cognitest/oauth-token-enc');
  }

  private derive(secret: string, info: string): Buffer {
    return Buffer.from(hkdfSync('sha256', secret, 'cognitest-hkdf-salt', info, 32));
  }

  /** 32 random bytes, base64url — 43 chars, the only raw-token format we use. */
  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    return createHmac('sha256', this.ipKey).update(ip).digest('hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(payload: string): string {
    const raw = Buffer.from(payload, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }
}
