import type { IntegrationSearchResult } from '@cognitest/shared';

import { authError, httpJson, trimUrl } from './http';
import type { ProviderClient, ProviderCredentials, ProviderVerifyResult } from './types';

const DEFAULT_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionRichText {
  plain_text?: string;
}
interface NotionObject {
  id: string;
  url?: string;
  object?: string;
  title?: NotionRichText[];
  properties?: Record<string, { type?: string; title?: NotionRichText[] }>;
}

/** Notion API, authenticated with an internal integration token. */
export class NotionClient implements ProviderClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(creds: ProviderCredentials) {
    this.baseUrl = trimUrl(creds.baseUrl || DEFAULT_API);
    this.headers = {
      authorization: `Bearer ${creds.token}`,
      'notion-version': NOTION_VERSION,
      'content-type': 'application/json',
      accept: 'application/json',
    };
  }

  async verify(): Promise<ProviderVerifyResult> {
    const { ok, status, data } = await httpJson(`${this.baseUrl}/users/me`, {
      headers: this.headers,
    });
    if (!ok) throw authError(status);
    const me = data as { name?: string; bot?: { owner?: { type?: string } } };
    return { accountLabel: me.name || 'Notion workspace' };
  }

  async search(query: string): Promise<IntegrationSearchResult[]> {
    const { ok, status, data } = await httpJson(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, page_size: 25 }),
    });
    if (!ok) throw authError(status);
    const results = (data as { results?: NotionObject[] }).results ?? [];
    return results.map((r) => this.toResult(r));
  }

  async getItem(key: string): Promise<IntegrationSearchResult | null> {
    const { ok, status, data } = await httpJson(`${this.baseUrl}/pages/${key}`, {
      headers: this.headers,
    });
    if (status === 404) return null;
    if (!ok) throw authError(status);
    return this.toResult(data as NotionObject);
  }

  private toResult(obj: NotionObject): IntegrationSearchResult {
    return {
      key: obj.id,
      title: this.titleOf(obj),
      url: obj.url ?? `https://notion.so/${obj.id.replace(/-/g, '')}`,
      state: null,
    };
  }

  /** Pulls a display title from a database (top-level title) or page (title property). */
  private titleOf(obj: NotionObject): string {
    const fromTop = obj.title?.map((t) => t.plain_text ?? '').join('');
    if (fromTop) return fromTop;
    for (const prop of Object.values(obj.properties ?? {})) {
      if (prop.type === 'title') {
        const text = prop.title?.map((t) => t.plain_text ?? '').join('');
        if (text) return text;
      }
    }
    return 'Untitled';
  }
}
