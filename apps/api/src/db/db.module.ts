import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { Env } from '../config/env.schema';
import * as schema from './schema';

export const PG_CLIENT = Symbol('PG_CLIENT');
export const DRIZZLE = Symbol('DRIZZLE');

export type Database = PostgresJsDatabase<typeof schema>;

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
        postgres(config.get('DATABASE_URL', { infer: true })),
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE,
      useFactory: (client: postgres.Sql): Database => drizzle(client, { schema }),
      inject: [PG_CLIENT],
    },
    DbShutdown,
  ],
  exports: [PG_CLIENT, DRIZZLE],
})
export class DbModule {}
