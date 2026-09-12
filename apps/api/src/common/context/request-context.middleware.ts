import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContextService) {}

  use(req: FastifyRequest['raw'], _res: FastifyReply['raw'], next: () => void): void {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ??
      req.socket.remoteAddress ??
      undefined;
    const userAgent = req.headers['user-agent'];
    this.ctx.run({ ip, userAgent }, next);
  }
}
