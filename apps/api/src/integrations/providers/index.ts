import type { ConnectIntegrationRequest, IntegrationProvider } from '@cognitest/shared';

import { BitbucketClient } from './bitbucket.client';
import { GithubClient } from './github.client';
import { IntegrationError } from './types';
import { JiraClient } from './jira.client';
import { NotionClient } from './notion.client';
import type { ProviderClient, ProviderCredentials } from './types';

export { IntegrationError } from './types';
export type { ProviderClient, ProviderCredentials, ProviderVerifyResult } from './types';

/** Builds the read-only REST client for a provider from decrypted credentials. */
export function createProviderClient(
  provider: IntegrationProvider,
  creds: ProviderCredentials,
): ProviderClient {
  switch (provider) {
    case 'jira':
      return new JiraClient(creds);
    case 'github':
      return new GithubClient(creds);
    case 'bitbucket':
      return new BitbucketClient(creds);
    case 'notion':
      return new NotionClient(creds);
    default:
      throw new IntegrationError(`Unknown provider: ${String(provider)}`);
  }
}

/**
 * Validates the connect request against the provider's required fields and
 * splits it into the secret token and the non-secret `config` we persist.
 * Throws IntegrationError (→ 400) when a required field is missing.
 */
export function splitConnectInput(
  provider: IntegrationProvider,
  input: ConnectIntegrationRequest,
): { config: Record<string, string>; credentials: ProviderCredentials } {
  const config: Record<string, string> = {};
  const assign = (key: 'baseUrl' | 'email' | 'username' | 'workspace') => {
    const value = input[key];
    if (value) config[key] = value;
  };

  switch (provider) {
    case 'jira':
      if (!input.baseUrl) throw new IntegrationError('A JIRA site URL is required.');
      if (!input.email) throw new IntegrationError('A JIRA account email is required.');
      assign('baseUrl');
      assign('email');
      break;
    case 'bitbucket':
      if (!input.username) throw new IntegrationError('A Bitbucket username is required.');
      assign('username');
      assign('workspace');
      assign('baseUrl');
      break;
    case 'github':
    case 'notion':
      assign('baseUrl');
      break;
  }

  return {
    config,
    credentials: {
      token: input.token,
      baseUrl: input.baseUrl,
      email: input.email,
      username: input.username,
      workspace: input.workspace,
    },
  };
}
