import { z } from 'zod';

export const healthCheckStateSchema = z.enum(['up', 'down']);
export type HealthCheckState = z.infer<typeof healthCheckStateSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    postgres: healthCheckStateSchema,
    redis: healthCheckStateSchema,
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
