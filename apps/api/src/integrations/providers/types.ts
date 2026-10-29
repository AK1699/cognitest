import type { IntegrationSearchResult } from '@cognitest/shared';

/** Decrypted credentials + non-secret config handed to a provider client. */
export interface ProviderCredentials {
  token: string;
  baseUrl?: string;
  email?: string;
  username?: string;
  workspace?: string;
}

export interface ProviderVerifyResult {
  /** Human-readable identity of the authenticated account (shown in the UI). */
  accountLabel: string;
}

/**
 * A thin, read-only client over a provider's REST API. Implementations only
 * talk HTTP — all persistence and tenancy live in the service layer.
 */
export interface ProviderClient {
  /** Confirms the credentials work; throws IntegrationError otherwise. */
  verify(): Promise<ProviderVerifyResult>;
  /** Free-text search for linkable items (issues, PRs, repos, pages). */
  search(query: string): Promise<IntegrationSearchResult[]>;
  /** Fetches one item by its provider key; null if it no longer exists. */
  getItem(key: string): Promise<IntegrationSearchResult | null>;
}

/** Surfaced to the user as a connection error / 400 — carries a safe message. */
export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationError';
  }
}
