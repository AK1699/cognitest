import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** The live session id attached by AuthGuard. Only valid on non-@Public routes. */
export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  const sessionId = request.sessionId;
  if (!sessionId) throw new Error('@CurrentSession used on a route without AuthGuard');
  return sessionId;
});
