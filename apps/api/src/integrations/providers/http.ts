import { IntegrationError } from './types';

const TIMEOUT_MS = 12_000;

export interface HttpResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/**
 * One-shot JSON fetch with a hard timeout. Never throws on HTTP status — the
 * caller decides what a 401/404 means — but turns network/timeouts/parse
 * failures into a user-safe IntegrationError.
 */
export async function httpJson(url: string, init: RequestInit): Promise<HttpResult> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    const reason =
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'the request timed out'
        : 'the service could not be reached';
    throw new IntegrationError(`Could not connect — ${reason}. Check the base URL and try again.`);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: res.ok, status: res.status, data };
}

export function basicAuth(user: string, secret: string): string {
  return `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`;
}

/** Trailing-slash-free base URL. */
export function trimUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Removes characters that would break a quoted JQL/BBQL string literal. */
export function sanitizeQuery(query: string): string {
  return query.replace(/["\\]/g, '').trim();
}

/** Maps a failed verify/search response to a readable IntegrationError. */
export function authError(status: number): IntegrationError {
  if (status === 401 || status === 403) {
    return new IntegrationError('Authentication failed — check the token and account details.');
  }
  return new IntegrationError(`The provider returned an unexpected status (${status}).`);
}
