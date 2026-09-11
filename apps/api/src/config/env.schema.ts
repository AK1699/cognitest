import { z } from 'zod';

/**
 * Every variable the API reads. Defaults match docker-compose.yml so local dev
 * works with no .env at all; a malformed value still fails fast at bootstrap.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Comma-separated list of allowed CORS origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.url().default('postgres://cognitest:cognitest@localhost:5432/cognitest'),
  REDIS_URL: z.url().default('redis://localhost:6379'),

  // Reserved for later phases — documented in .env.example, unused for now.
  S3_ENDPOINT: z.url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().optional(),
  MAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
