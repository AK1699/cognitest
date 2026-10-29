import { z } from 'zod';

import {
  EXTERNAL_LINK_ENTITY_TYPES,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
} from '../enums';

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/**
 * Public view of a connection — the stored API token is NEVER serialised. Only
 * the non-secret config (base URL, account email, workspace…) comes back.
 */
export const integrationConnectionSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  provider: z.enum(INTEGRATION_PROVIDERS),
  status: z.enum(INTEGRATION_STATUSES),
  config: z.record(z.string(), z.string()),
  accountLabel: z.string().nullable(),
  lastError: z.string().nullable(),
  lastVerifiedAt: z.coerce.date().nullable(),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>;

/**
 * Connect or re-connect a provider. `token` is the secret (JIRA/Notion API
 * token, GitHub PAT, Bitbucket app password); the rest is provider config.
 * Per-provider requirements (JIRA needs baseUrl + email, Bitbucket needs a
 * username) are enforced server-side so one DTO covers all four.
 */
export const connectIntegrationRequestSchema = z.object({
  token: z.string().min(1, 'An API token is required').max(1000),
  baseUrl: z.url().max(300).optional(),
  email: z.email().max(200).optional(),
  username: z.string().max(200).optional(),
  workspace: z.string().max(200).optional(),
});
export type ConnectIntegrationRequest = z.infer<typeof connectIntegrationRequestSchema>;

// ---------------------------------------------------------------------------
// Search (issues / pull requests / repositories / Notion pages)
// ---------------------------------------------------------------------------

export const integrationSearchResultSchema = z.object({
  key: z.string(),
  title: z.string(),
  url: z.string(),
  state: z.string().nullable(),
});
export type IntegrationSearchResult = z.infer<typeof integrationSearchResultSchema>;

// ---------------------------------------------------------------------------
// External links (requirement/test-case ⇄ external item)
// ---------------------------------------------------------------------------

export const externalLinkSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  provider: z.enum(INTEGRATION_PROVIDERS),
  entityType: z.enum(EXTERNAL_LINK_ENTITY_TYPES),
  entityId: z.uuid(),
  externalKey: z.string(),
  externalUrl: z.string(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  syncedAt: z.coerce.date().nullable(),
  createdBy: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ExternalLink = z.infer<typeof externalLinkSchema>;

export const createExternalLinkRequestSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
  entityType: z.enum(EXTERNAL_LINK_ENTITY_TYPES),
  entityId: z.uuid(),
  externalKey: z.string().min(1).max(300),
  externalUrl: z.string().max(1000).optional(),
  title: z.string().max(500).optional(),
  state: z.string().max(100).optional(),
});
export type CreateExternalLinkRequest = z.infer<typeof createExternalLinkRequestSchema>;

// ---------------------------------------------------------------------------
// Import external items as requirements
// ---------------------------------------------------------------------------

export const importRequirementsRequestSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
  designId: z.uuid().optional(),
  keys: z.array(z.string().min(1).max(300)).min(1, 'Pick at least one item').max(50),
});
export type ImportRequirementsRequest = z.infer<typeof importRequirementsRequestSchema>;
