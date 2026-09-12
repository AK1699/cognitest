import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { AuthUser } from '@cognitest/shared';

/** The authenticated user attached by AuthGuard. Only valid on non-@Public routes. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  const user = request.user;
  if (!user) throw new Error('@CurrentUser used on a route without AuthGuard');
  return user as AuthUser;
});
