import type { AuthUser } from '@cognitest/shared';

declare module 'fastify' {
  interface FastifyRequest {
    /** Attached by AuthGuard on non-@Public routes. */
    user?: AuthUser;
    /** Live session id, attached by AuthGuard alongside user. */
    sessionId?: string;
  }
}
