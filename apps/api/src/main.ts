import 'reflect-metadata';

import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import type { Env } from './config/env.schema';
import { loadEnv } from './config/load-env';

async function bootstrap(): Promise<void> {
  loadEnv();

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);

  await app.register(helmet);
  await app.register(cookie);
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(','),
    credentials: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();

  // 0.0.0.0 so the API is reachable from containers, not just the host
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
