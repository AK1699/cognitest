import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';

import type { Env } from '../../config/env.schema';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defence-in-depth on top of SameSite=Lax cookies: a browser-sent mutating
 * request must originate from our own web origin. Requests without an Origin
 * header (curl, server-to-server, tests) pass — cookie theft is out of CSRF
 * scope and cross-site browser requests always carry Origin.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigins = new Set([
      config.get('WEB_ORIGIN', { infer: true }),
      ...config.get('CORS_ORIGIN', { infer: true }).split(','),
    ]);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!MUTATING_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin && !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Cross-origin request rejected');
    }
    return true;
  }
}
