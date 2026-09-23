import { randomUUID } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Sql } from 'postgres';

import { sessionCookie } from './test-app';

// random /16 per spec file — throttle buckets live in shared Redis, so a fixed
// base would trip rate limits across suites
const ipBase = `10.${100 + Math.floor(Math.random() * 100)}`;
let ipCounter = 1;
export const uniqueIp = () => `${ipBase}.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

export interface FixtureUser {
  id: string;
  email: string;
  cookie: { cookie: string };
}

/** Signs a user up (they get their own workspace) and returns id + session. */
export async function signupUser(
  app: NestFastifyApplication,
  emailDomain: string,
  tag: string,
): Promise<FixtureUser> {
  const run = randomUUID().slice(0, 8);
  const email = `${tag}-${run}@${emailDomain}`;
  const res = await app
    .getHttpAdapter()
    .getInstance()
    .inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email,
        username: `${tag}-${run}`,
        password: 'A-long-secure-passw0rd',
        displayName: `User ${tag}`,
        organizationName: `${tag} Workspace`,
      },
      remoteAddress: uniqueIp(),
    });
  if (res.statusCode !== 201) throw new Error(`signup failed: ${res.body}`);
  const token = sessionCookie(res);
  const user = (res.json() as { user: { id: string } }).user;
  return { id: user.id, email, cookie: { cookie: `cognitest_session=${token}` } };
}

export async function organizationOf(owner: Sql, userId: string): Promise<string> {
  const [row] = await owner`select organization_id from organization_members
    where user_id = ${userId} limit 1`;
  if (!row) throw new Error('user has no organization');
  return row.organization_id as string;
}

/** Adds a user to an organization with the given system role (test shortcut). */
export async function addMemberWithRole(
  owner: Sql,
  organizationId: string,
  userId: string,
  roleKey: string,
): Promise<void> {
  const [role] = await owner`select id from roles where key = ${roleKey} and is_system`;
  if (!role) throw new Error(`unknown system role ${roleKey}`);
  await owner`insert into organization_members (organization_id, user_id, role_id)
    values (${organizationId}, ${userId}, ${role.id})
    on conflict (organization_id, user_id) do update set role_id = ${role.id}`;
}
