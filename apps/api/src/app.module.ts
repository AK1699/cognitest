import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ContextModule } from './common/context/context.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { validateEnv } from './config/env.schema';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RbacModule } from './rbac/rbac.module';
import { RedisModule } from './redis/redis.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // .env loading happens in loadEnv() before bootstrap; validation here
    // aborts startup on any malformed variable.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ContextModule,
    DbModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    InvitationsModule,
    RbacModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // every request gets an AsyncLocalStorage context before any guard runs
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
