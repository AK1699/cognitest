import { z } from 'zod';

/**
 * Every variable the API reads. Defaults match docker-compose.yml so local dev
 * works with no .env at all; a malformed value still fails fast at bootstrap.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    /** Comma-separated list of allowed CORS origins. */
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    /** Runtime connection — must use the non-owner `cognitest_app` role so RLS applies. */
    DATABASE_URL: z.url().default('postgres://cognitest:cognitest@localhost:5432/cognitest'),
    /**
     * Owner connection for migrations/seed only (RLS bypass is intentional there).
     * Falls back to DATABASE_URL when unset.
     */
    DATABASE_URL_MIGRATIONS: z.url().optional(),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.url().default('redis://localhost:6379'),

    /** Public origin of the web app: CSRF allowlist, mail links, OIDC redirect base. */
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    /** Master secret; HKDF subkeys derive ip-hash and oauth-token-encryption keys. */
    AUTH_SECRET: z.string().min(32).default('dev-only-auth-secret-change-me-0123456789'),
    SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(30 * 24 * 60 * 60),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_TENANT: z.string().default('common'),

    // matches docker-compose Mailpit; set empty in environments without SMTP
    // to fall back to the no-op json transport
    MAIL_HOST: z.string().optional().default('localhost'),
    MAIL_PORT: z.coerce.number().int().positive().default(1025),
    MAIL_FROM: z.string().default('noreply@cognitest.local'),

    // Reserved for later phases — documented in .env.example, unused for now.
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.AUTH_SECRET.startsWith('dev-only-'), {
    message: 'AUTH_SECRET must be set to a real value in production',
    path: ['AUTH_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
