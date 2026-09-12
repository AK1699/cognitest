import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

// OWASP baseline for Argon2id: 19 MiB memory, 2 iterations, 1 lane
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

@Injectable()
export class PasswordService {
  /** Verified against when the email is unknown, so timing stays uniform. */
  private dummyHash: string | undefined;

  async hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }

  /** Burns the same argon2 work as a real verify; always returns false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= await this.hash('dummy-password-for-constant-time');
    await this.verify(this.dummyHash, password);
    return false;
  }
}
