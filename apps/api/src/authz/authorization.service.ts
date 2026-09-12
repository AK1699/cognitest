import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type Redis from 'ioredis';

import type { PermissionKey } from '@cognitest/shared';

import { REDIS } from '../redis/redis.module';
import { TenantDb } from '../db/tenant-db.service';
import {
  organizationMembers,
  permissions,
  projectMembers,
  rolePermissions,
  teamMembers,
} from '../db/schema';

export interface Membership {
  membershipId: string;
  roleId: string | null;
  status: 'active' | 'suspended';
}

const MEMBER_TTL = 300;
const TEAMS_TTL = 300;
const PERMS_TTL = 600;
const PROJECT_TTL = 300;

/**
 * Effective-authorization lookups with Redis caching. Every cache is a plain
 * key with TTL; mutation paths call the invalidate* methods synchronously —
 * member removal/suspension is the security-critical one.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly tenantDb: TenantDb,
  ) {}

  async getMembership(organizationId: string, userId: string): Promise<Membership | null> {
    const key = `authz:member:${organizationId}:${userId}`;
    const cached = await this.redisGet(key);
    if (cached) return JSON.parse(cached) as Membership | null;

    const rows = await this.tenantDb.runAsUser(userId, (tx) =>
      tx
        .select({
          membershipId: organizationMembers.id,
          roleId: organizationMembers.roleId,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, userId),
          ),
        ),
    );
    const membership = rows[0] ?? null;
    await this.redisSet(key, JSON.stringify(membership), MEMBER_TTL);
    return membership;
  }

  /** Requires org context in RequestContext (call after TenantGuard patched it). */
  async getTeamIds(organizationId: string, userId: string): Promise<string[]> {
    const key = `authz:teams:${organizationId}:${userId}`;
    const cached = await this.redisGet(key);
    if (cached) return JSON.parse(cached) as string[];

    const rows = await this.tenantDb.run((tx) =>
      tx
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId)),
    );
    const teamIds = rows.map((row) => row.teamId);
    await this.redisSet(key, JSON.stringify(teamIds), TEAMS_TTL);
    return teamIds;
  }

  async getRolePermissions(roleId: string): Promise<Set<PermissionKey>> {
    const key = `authz:perms:role:${roleId}`;
    const cached = await this.redisGet(key);
    if (cached) return new Set(JSON.parse(cached) as PermissionKey[]);

    const rows = await this.tenantDb.run((tx) =>
      tx
        .select({ key: permissions.key })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(rolePermissions.roleId, roleId)),
    );
    const keys = rows.map((row) => row.key as PermissionKey);
    await this.redisSet(key, JSON.stringify(keys), PERMS_TTL);
    return new Set(keys);
  }

  async hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const key = `authz:project:${projectId}:${userId}`;
    const cached = await this.redisGet(key);
    if (cached) return cached === '1';

    // RLS scopes the lookup to the current org, so a foreign projectId is invisible
    const rows = await this.tenantDb.run((tx) =>
      tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))),
    );
    const has = rows.length > 0;
    await this.redisSet(key, has ? '1' : '0', PROJECT_TTL);
    return has;
  }

  async invalidateMember(organizationId: string, userId: string): Promise<void> {
    await this.redisDel(
      `authz:member:${organizationId}:${userId}`,
      `authz:teams:${organizationId}:${userId}`,
    );
  }

  async invalidateRole(roleId: string): Promise<void> {
    await this.redisDel(`authz:perms:role:${roleId}`);
  }

  async invalidateTeams(organizationId: string, userId: string): Promise<void> {
    await this.redisDel(`authz:teams:${organizationId}:${userId}`);
  }

  async invalidateProjectAccess(projectId: string, userId: string): Promise<void> {
    await this.redisDel(`authz:project:${projectId}:${userId}`);
  }

  private async redisGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  private async redisSet(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttl);
    } catch {
      // cache only — DB remains authoritative
    }
  }

  private async redisDel(...keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys);
    } catch {
      // a missed DEL self-heals at TTL expiry
    }
  }
}
