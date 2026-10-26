import type { IntegrationSearchResult } from '@cognitest/shared';

import { authError, basicAuth, httpJson, sanitizeQuery, trimUrl } from './http';
import { IntegrationError } from './types';
import type { ProviderClient, ProviderCredentials, ProviderVerifyResult } from './types';

const DEFAULT_API = 'https://api.bitbucket.org/2.0';

interface BitbucketRepo {
  full_name?: string;
  name?: string;
  links?: { html?: { href?: string } };
  updated_on?: string;
}

/**
 * Bitbucket Cloud REST v2, authenticated with username + app password. Search
 * targets repositories (tests trace against commits), not issues, since issue
 * trackers are per-repo and often disabled.
 */
export class BitbucketClient implements ProviderClient {
  private readonly baseUrl: string;
  private readonly workspace?: string;
  private readonly headers: Record<string, string>;

  constructor(creds: ProviderCredentials) {
    if (!creds.username) throw new IntegrationError('A Bitbucket username is required.');
    this.baseUrl = trimUrl(creds.baseUrl || DEFAULT_API);
    this.workspace = creds.workspace;
    this.headers = {
      authorization: basicAuth(creds.username, creds.token),
      accept: 'application/json',
    };
  }

  async verify(): Promise<ProviderVerifyResult> {
    const { ok, status, data } = await httpJson(`${this.baseUrl}/user`, { headers: this.headers });
    if (!ok) throw authError(status);
    const me = data as { display_name?: string; username?: string; nickname?: string };
    return { accountLabel: me.display_name || me.nickname || me.username || 'Bitbucket account' };
  }

  async search(query: string): Promise<IntegrationSearchResult[]> {
    const q = sanitizeQuery(query);
    const params = new URLSearchParams({ pagelen: '25', sort: '-updated_on' });
    if (!this.workspace) params.set('role', 'member');
    if (q) params.set('q', `name~"${q}"`);
    const path = this.workspace ? `/repositories/${this.workspace}` : '/repositories';
    const url = `${this.baseUrl}${path}?${params.toString()}`;
    const { ok, status, data } = await httpJson(url, { headers: this.headers });
    if (!ok) throw authError(status);
    const repos = (data as { values?: BitbucketRepo[] }).values ?? [];
    return repos.map((repo) => this.toResult(repo)).filter((r): r is IntegrationSearchResult => !!r);
  }

  async getItem(key: string): Promise<IntegrationSearchResult | null> {
    // key is the repository full_name: workspace/repo
    const url = `${this.baseUrl}/repositories/${key}`;
    const { ok, status, data } = await httpJson(url, { headers: this.headers });
    if (status === 404) return null;
    if (!ok) throw authError(status);
    return this.toResult(data as BitbucketRepo);
  }

  private toResult(repo: BitbucketRepo): IntegrationSearchResult | null {
    if (!repo.full_name) return null;
    return {
      key: repo.full_name,
      title: repo.name ?? repo.full_name,
      url: repo.links?.html?.href ?? `https://bitbucket.org/${repo.full_name}`,
      state: null,
    };
  }
}
