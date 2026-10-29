import type { IntegrationSearchResult } from '@cognitest/shared';

import { authError, httpJson, trimUrl } from './http';
import { IntegrationError } from './types';
import type { ProviderClient, ProviderCredentials, ProviderVerifyResult } from './types';

const DEFAULT_API = 'https://api.github.com';
// owner/repo#number, e.g. octocat/hello-world#42
const ISSUE_KEY = /^([^/\s]+)\/([^#\s]+)#(\d+)$/;

interface GithubIssue {
  title?: string;
  html_url?: string;
  state?: string;
  number?: number;
  repository_url?: string;
}

/** GitHub REST, authenticated with a personal access token (fine-grained or classic). */
export class GithubClient implements ProviderClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(creds: ProviderCredentials) {
    this.baseUrl = trimUrl(creds.baseUrl || DEFAULT_API);
    this.headers = {
      authorization: `Bearer ${creds.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'cognitest',
    };
  }

  async verify(): Promise<ProviderVerifyResult> {
    const { ok, status, data } = await httpJson(`${this.baseUrl}/user`, { headers: this.headers });
    if (!ok) throw authError(status);
    const me = data as { login?: string; name?: string };
    return { accountLabel: me.name || me.login || 'GitHub account' };
  }

  async search(query: string): Promise<IntegrationSearchResult[]> {
    const url = `${this.baseUrl}/search/issues?q=${encodeURIComponent(query)}&per_page=25`;
    const { ok, status, data } = await httpJson(url, { headers: this.headers });
    if (!ok) throw authError(status);
    const items = (data as { items?: GithubIssue[] }).items ?? [];
    return items.map((item) => this.toResult(item)).filter((r): r is IntegrationSearchResult => !!r);
  }

  async getItem(key: string): Promise<IntegrationSearchResult | null> {
    const match = ISSUE_KEY.exec(key);
    if (!match) throw new IntegrationError('Expected a GitHub key like "owner/repo#number".');
    const [, owner, repo, number] = match;
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${number}`;
    const { ok, status, data } = await httpJson(url, { headers: this.headers });
    if (status === 404) return null;
    if (!ok) throw authError(status);
    const issue = data as GithubIssue;
    return {
      key,
      title: issue.title ?? key,
      url: issue.html_url ?? `https://github.com/${owner}/${repo}/issues/${number}`,
      state: issue.state ?? null,
    };
  }

  private toResult(item: GithubIssue): IntegrationSearchResult | null {
    if (!item.html_url || item.number === undefined) return null;
    // repository_url is https://api.github.com/repos/{owner}/{repo}
    const repo = item.repository_url?.split('/repos/')[1] ?? '';
    const key = repo ? `${repo}#${item.number}` : `#${item.number}`;
    return {
      key,
      title: item.title ?? key,
      url: item.html_url,
      state: item.state ?? null,
    };
  }
}
