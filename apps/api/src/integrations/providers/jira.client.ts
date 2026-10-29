import type { IntegrationSearchResult } from '@cognitest/shared';

import { authError, basicAuth, httpJson, sanitizeQuery, trimUrl } from './http';
import { IntegrationError } from './types';
import type { ProviderClient, ProviderCredentials, ProviderVerifyResult } from './types';

const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/i;

interface JiraIssue {
  key: string;
  fields?: { summary?: string; status?: { name?: string } };
}

/** JIRA Cloud REST v3, authenticated with email + API token (Basic auth). */
export class JiraClient implements ProviderClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(creds: ProviderCredentials) {
    if (!creds.baseUrl) throw new IntegrationError('A JIRA site URL is required.');
    if (!creds.email) throw new IntegrationError('A JIRA account email is required.');
    this.baseUrl = trimUrl(creds.baseUrl);
    this.headers = {
      authorization: basicAuth(creds.email, creds.token),
      accept: 'application/json',
    };
  }

  async verify(): Promise<ProviderVerifyResult> {
    const { ok, status, data } = await httpJson(`${this.baseUrl}/rest/api/3/myself`, {
      headers: this.headers,
    });
    if (!ok) throw authError(status);
    const me = data as { displayName?: string; emailAddress?: string };
    return { accountLabel: me.displayName || me.emailAddress || 'JIRA account' };
  }

  async search(query: string): Promise<IntegrationSearchResult[]> {
    const q = sanitizeQuery(query);
    const jql = ISSUE_KEY.test(q)
      ? `key = "${q}" OR summary ~ "${q}*" ORDER BY updated DESC`
      : `summary ~ "${q}*" ORDER BY updated DESC`;
    const url = `${this.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=25&fields=summary,status`;
    const { ok, status, data } = await httpJson(url, { headers: this.headers });
    if (!ok) throw authError(status);
    const issues = (data as { issues?: JiraIssue[] }).issues ?? [];
    return issues.map((issue) => this.toResult(issue));
  }

  async getItem(key: string): Promise<IntegrationSearchResult | null> {
    const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,status`;
    const { ok, status, data } = await httpJson(url, { headers: this.headers });
    if (status === 404) return null;
    if (!ok) throw authError(status);
    return this.toResult(data as JiraIssue);
  }

  private toResult(issue: JiraIssue): IntegrationSearchResult {
    return {
      key: issue.key,
      title: issue.fields?.summary ?? issue.key,
      url: `${this.baseUrl}/browse/${issue.key}`,
      state: issue.fields?.status?.name ?? null,
    };
  }
}
