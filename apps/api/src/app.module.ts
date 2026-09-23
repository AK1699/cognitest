import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type Redis from 'ioredis';
import { LoggerModule } from 'nestjs-pino';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { AuthzModule } from './authz/authz.module';
import { PermissionGuard } from './authz/guards/permission.guard';
import { TenantGuard } from './authz/guards/tenant.guard';
import { ContextModule } from './common/context/context.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { validateEnv } from './config/env.schema';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { RbacModule } from './rbac/rbac.module';
import { REDIS, RedisModule } from './redis/redis.module';
import { TeamsModule } from './teams/teams.module';
import { TestArtifactsModule } from './test-artifacts/test-artifacts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // .env loading happens in loadEnv() before bootstrap; validation here
    // aborts startup on any malformed variable.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ContextModule,
    DbModule,
    RedisModule,
    // generous default ceiling; auth routes tighten per-route with @Throttle
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
      inject: [REDIS],
    }),
    HealthModule,
    AuthModule,
    AuthzModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    TeamsModule,
    TestArtifactsModule,
    InvitationsModule,
    RbacModule,
    AuditModule,
  ],
  // global guards run in registration order (spec §29):
  // rate limit → authn → CSRF → tenant → permission
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // every request gets an AsyncLocalStorage context before any guard runs
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
