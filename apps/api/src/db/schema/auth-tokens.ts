import { index, pgEnum, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { identitySchema } from './schemas';

import { AUTH_TOKEN_TYPES } from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { users } from './users';

export const authTokenType = pgEnum('auth_token_type', AUTH_TOKEN_TYPES);

/**
 * Single-use, short-lived tokens for email verification and password reset.
 * Only the sha256 of the raw token is stored; issuing a new token of a type
 * consumes the user's outstanding tokens of that type.
 */
export const authTokens = identitySchema.table(
  'auth_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: authTokenType('type').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('auth_tokens_user_type_idx').on(t.userId, t.type)],
);
