import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { id, timestamps } from './helpers';
import { users } from './users';

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    // HMAC of the client IP — equality-comparable for device listing, no raw PII
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);
