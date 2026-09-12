import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { Env } from '../config/env.schema';
import { DRIZZLE, PG_CLIENT } from './db.tokens';
import type { Database } from './db.tokens';
import * as schema from './schema';
import { TenantDb } from './tenant-db.service';

export { DRIZZLE, PG_CLIENT } from './db.tokens';
export type { Database } from './db.tokens';

@Injectable()
class DbShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      useFactory: (config: ConfigService<Env, true>) =>
        postgres(config.get('DATABASE_URL', { infer: true }), {
          max: config.get('DB_POOL_MAX', { infer: true }),
        }),
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE,
      useFactory: (client: postgres.Sql): Database => drizzle(client, { schema }),
      inject: [PG_CLIENT],
    },
    TenantDb,
    DbShutdown,
  ],
  exports: [PG_CLIENT, DRIZZLE, TenantDb],
})
export class DbModule {}
