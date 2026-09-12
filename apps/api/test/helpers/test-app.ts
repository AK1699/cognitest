import cookie from '@fastify/cookie';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { TestingModuleBuilder } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';
import { MAILER } from '../../src/auth/services/mail.service';
import { runMigrations } from '../../src/db/migrate';
import { runSeed } from '../../src/db/seed';

/** Seed edits change role permissions — cached sets from earlier runs must go. */
async function flushAuthzCaches(): Promise<void> {
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const keys = await redis.keys('authz:*');
    if (keys.length > 0) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}

export interface CapturedMail {
  to: string;
  subject: string;
  text: string;
}

export class CapturingMailer {
  readonly sent: CapturedMail[] = [];

  sendMail(mail: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push(mail);
    return Promise.resolve();
  }

  /** Pulls the raw one-time token out of the last mail sent to an address. */
  lastTokenFor(to: string): string | null {
    const mail = [...this.sent].reverse().find((m) => m.to === to);
    return mail?.text.match(/token=([A-Za-z0-9_-]{43})/)?.[1] ?? null;
  }
}

/** Boots the full AppModule the way main.ts does: cookies, pipes, migrations+seed. */
export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<{ app: NestFastifyApplication; mailer: CapturingMailer }> {
  await runMigrations();
  await runSeed();
  await flushAuthzCaches();

  const mailer = new CapturingMailer();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer);
  if (configure) builder = configure(builder);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.register(cookie);
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, mailer };
}

/** Extracts the session cookie value from a fastify inject response. */
export function sessionCookie(res: {
  cookies: { name: string; value: string }[];
}): string | undefined {
  return res.cookies.find((c) => c.name === 'cognitest_session')?.value;
}

export function cookieHeader(value: string): { cookie: string } {
  return { cookie: `cognitest_session=${value}` };
}

/**
 * Removes users matching an email LIKE pattern plus every organization they
 * belong to (FK-safe order). Owner connection required.
 */
export async function cleanupUsers(
  owner: import('postgres').Sql,
  emailPattern: string,
): Promise<void> {
  const orgs = await owner`
    select distinct om.organization_id as id from organization_members om
    join users u on u.id = om.user_id where u.email like ${emailPattern}`;
  const orgIds = orgs.map((o) => o.id as string);
  if (orgIds.length > 0) {
    await owner`delete from audit_logs where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from invitations where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from project_members where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from projects where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from team_members where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from teams where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from organization_members where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from role_permissions where role_id in
      (select id from roles where organization_id = any(${orgIds}::uuid[]))`;
    await owner`delete from roles where organization_id = any(${orgIds}::uuid[])`;
    await owner`delete from organizations where id = any(${orgIds}::uuid[])`;
  }
  await owner`delete from audit_logs where actor_user_id in
    (select id from users where email like ${emailPattern})`;
  await owner`delete from users where email like ${emailPattern}`;
}
