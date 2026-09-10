import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { USER_STATUSES } from '@cognitest/shared';

import { citext, id, timestamps } from './helpers';

export const userStatus = pgEnum('user_status', USER_STATUSES);

export const users = pgTable('users', {
  id: id(),
  email: citext('email').notNull().unique(),
  // nullable: OAuth-only users have no password
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  status: userStatus('status').notNull().default('active'),
  ...timestamps,
});
