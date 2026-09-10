import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Case-insensitive text (requires the citext extension, enabled in 0000). */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

export const id = () => uuid('id').primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};
