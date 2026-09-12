interface PgError {
  code?: string;
  constraint_name?: string;
}

/**
 * Drizzle wraps postgres.js errors in DrizzleQueryError with the original on
 * `cause` — inspect both. 23505 = unique_violation, 23503 = fk_violation.
 */
function pgError(error: unknown): PgError | null {
  if (typeof error !== 'object' || error === null) return null;
  const cause = (error as { cause?: unknown }).cause;
  const candidate = (typeof cause === 'object' && cause !== null ? cause : error) as PgError;
  return typeof candidate.code === 'string' ? candidate : null;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgError(error);
  return pg?.code === '23505' && (!constraint || pg.constraint_name === constraint);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return pgError(error)?.code === '23503';
}
