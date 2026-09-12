import { boolean, pgEnum, text, timestamp } from 'drizzle-orm/pg-core';

import { identitySchema } from './schemas';

import { USER_STATUSES } from '@cognitest/shared';

import { citext, id, timestamps } from './helpers';

export const userStatus = pgEnum('user_status', USER_STATUSES);

export const users = identitySchema.table('users', {
  id: id(),
  email: citext('email').notNull().unique(),
  // nullable: OIDC-only users have no username (never auto-generated)
  username: citext('username').unique(),
  // nullable: OAuth-only users have no password
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  status: userStatus('status').notNull().default('active'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...timestamps,
});
