import { pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { OAUTH_PROVIDERS } from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { users } from './users';

export const oauthProvider = pgEnum('oauth_provider', OAUTH_PROVIDERS);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: oauthProvider('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    ...timestamps,
  },
  (t) => [unique('oauth_accounts_provider_account_uq').on(t.provider, t.providerAccountId)],
);
