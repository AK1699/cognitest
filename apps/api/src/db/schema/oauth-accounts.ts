import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { OAUTH_PROVIDERS } from '@cognitest/shared';

import { citext, id, timestamps } from './helpers';
import { users } from './users';

export const oauthProvider = pgEnum('oauth_provider', OAUTH_PROVIDERS);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProvider('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    emailAtProvider: citext('email_at_provider'),
    // AES-256-GCM, schema-ready: stay NULL while no offline scopes are requested
    accessTokenEncrypted: text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique('oauth_accounts_provider_account_uq').on(t.provider, t.providerAccountId)],
);
