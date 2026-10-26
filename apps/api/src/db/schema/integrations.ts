import { index, jsonb, pgEnum, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import {
  EXTERNAL_LINK_ENTITY_TYPES,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
} from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';
import { productSchema } from './schemas';
import { users } from './users';

export const integrationProvider = pgEnum('integration_provider', INTEGRATION_PROVIDERS);
export const integrationStatus = pgEnum('integration_status', INTEGRATION_STATUSES);
export const externalLinkEntityType = pgEnum('external_link_entity_type', EXTERNAL_LINK_ENTITY_TYPES);

/**
 * One connection per (organisation, provider). The API token is stored
 * AES-256-GCM encrypted in `secret_encrypted` and never leaves the service
 * layer; `config` holds only non-secret settings (base URL, account email,
 * workspace) that are safe to return to the client.
 */
export const integrationConnections = productSchema.table(
  'integration_connections',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    status: integrationStatus('status').notNull().default('connected'),
    config: jsonb('config').$type<Record<string, string>>().notNull().default({}),
    secretEncrypted: text('secret_encrypted').notNull(),
    accountLabel: text('account_label'),
    lastError: text('last_error'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('integration_connections_org_provider_uq').on(t.organizationId, t.provider),
    index('integration_connections_org_idx').on(t.organizationId),
  ],
);

/**
 * Links a product entity (requirement, test case, test design) to an external
 * item. Polymorphic on (entity_type, entity_id) with no FK — same pattern as
 * `approvals` — so RLS + organization_id scoping does the containment.
 */
export const externalLinks = productSchema.table(
  'external_links',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    entityType: externalLinkEntityType('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    externalKey: text('external_key').notNull(),
    externalUrl: text('external_url').notNull(),
    title: text('title'),
    state: text('state'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('external_links_entity_item_uq').on(
      t.organizationId,
      t.entityType,
      t.entityId,
      t.provider,
      t.externalKey,
    ),
    index('external_links_entity_idx').on(t.organizationId, t.entityType, t.entityId),
    index('external_links_org_idx').on(t.organizationId),
  ],
);
