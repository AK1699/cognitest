import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Env } from '../config/env.schema';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    // quit() rejects if the connection never came up — that must not block shutdown
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService<Env, true>) =>
        // lazyConnect + capped retries: a down Redis degrades /health instead
        // of crash-looping the whole app at bootstrap
        new Redis(config.get('REDIS_URL', { infer: true }), {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        }),
      inject: [ConfigService],
    },
    RedisShutdown,
  ],
  exports: [REDIS],
})
export class RedisModule {}
