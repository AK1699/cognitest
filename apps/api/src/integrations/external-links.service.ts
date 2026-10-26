import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import {
  type CreateExternalLinkRequest,
  type ExternalLink,
  type ExternalLinkEntityType,
  type ImportRequirementsRequest,
  type IntegrationProvider,
  type Requirement,
} from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { externalLinks, requirements, testDesigns } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';
import type { Database } from '../db/db.tokens';
import { IntegrationsService } from './integrations.service';
import { IntegrationError } from './providers';

type LinkRow = typeof externalLinks.$inferSelect;
type RequirementRow = typeof requirements.$inferSelect;

@Injectable()
export class ExternalLinksService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly integrations: IntegrationsService,
  ) {}

  /** Links attached to one product entity, newest first. */
  async list(
    organizationId: string,
    entityType: ExternalLinkEntityType,
    entityId: string,
  ): Promise<ExternalLink[]> {
    const rows = await this.tenantDb.run((tx) =>
      tx
        .select()
        .from(externalLinks)
        .where(
          and(
            eq(externalLinks.organizationId, organizationId),
            eq(externalLinks.entityType, entityType),
            eq(externalLinks.entityId, entityId),
          ),
        )
        .orderBy(desc(externalLinks.createdAt)),
    );
    return rows.map(toLink);
  }

  /**
   * Records a link. When the caller already has the item's URL/title (from a
   * search result) nothing hits the network; otherwise we best-effort enrich
   * from the connected provider and fall back to the key.
   */
  async create(
    organizationId: string,
    userId: string,
    input: CreateExternalLinkRequest,
  ): Promise<ExternalLink> {
    let externalUrl = input.externalUrl;
    let title = input.title ?? null;
    let state = input.state ?? null;
    let syncedAt: Date | null = null;

    if (!externalUrl) {
      const enriched = await this.tryFetch(organizationId, input.provider, input.externalKey);
      if (enriched) {
        externalUrl = enriched.url;
        title = title ?? enriched.title;
        state = state ?? enriched.state;
        syncedAt = new Date();
      }
    }

    const row = await this.tenantDb.run(async (tx) => {
      const [saved] = await tx
        .insert(externalLinks)
        .values({
          organizationId,
          provider: input.provider,
          entityType: input.entityType,
          entityId: input.entityId,
          externalKey: input.externalKey,
          externalUrl: externalUrl ?? input.externalKey,
          title,
          state,
          syncedAt,
          createdBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            externalLinks.organizationId,
            externalLinks.entityType,
            externalLinks.entityId,
            externalLinks.provider,
            externalLinks.externalKey,
          ],
          set: { externalUrl: externalUrl ?? input.externalKey, title, state, syncedAt, updatedAt: new Date() },
        })
        .returning();
      if (!saved) throw new Error('external link insert returned no row');
      await this.audit.log(
        {
          action: 'INTEGRATION_LINK_CREATED',
          resourceType: 'external_link',
          resourceId: saved.id,
          metadata: { provider: input.provider, entityType: input.entityType, key: input.externalKey },
        },
        tx,
      );
      return saved;
    });
    return toLink(row);
  }

  /** Refreshes a link's title/state from the provider. */
  async sync(organizationId: string, linkId: string): Promise<ExternalLink> {
    const link = await this.tenantDb.run((tx) =>
      tx
        .select()
        .from(externalLinks)
        .where(and(eq(externalLinks.organizationId, organizationId), eq(externalLinks.id, linkId)))
        .then((rows) => rows[0]),
    );
    if (!link) throw new NotFoundException('Link not found');

    const client = await this.integrations.clientFor(organizationId, link.provider);
    let item;
    try {
      item = await client.getItem(link.externalKey);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Sync failed');
    }
    if (!item) throw new NotFoundException('The linked item no longer exists in the provider');

    const [updated] = await this.tenantDb.run((tx) =>
      tx
        .update(externalLinks)
        .set({ title: item.title, state: item.state ?? null, externalUrl: item.url, syncedAt: new Date(), updatedAt: new Date() })
        .where(eq(externalLinks.id, link.id))
        .returning(),
    );
    if (!updated) throw new NotFoundException('Link not found');
    return toLink(updated);
  }

  async remove(organizationId: string, linkId: string): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [deleted] = await tx
        .delete(externalLinks)
        .where(and(eq(externalLinks.organizationId, organizationId), eq(externalLinks.id, linkId)))
        .returning({ id: externalLinks.id });
      if (!deleted) throw new NotFoundException('Link not found');
      await this.audit.log(
        { action: 'INTEGRATION_LINK_DELETED', resourceType: 'external_link', resourceId: deleted.id },
        tx,
      );
    });
  }

  /**
   * Pulls external items into the project as requirements, each carrying an
   * external link back to its source. Requires the provider to be connected.
   */
  async importRequirements(
    organizationId: string,
    projectId: string,
    userId: string,
    input: ImportRequirementsRequest,
  ): Promise<{ imported: number; requirements: Requirement[] }> {
    if (input.designId) await this.assertDesignInProject(organizationId, projectId, input.designId);
    const client = await this.integrations.clientFor(organizationId, input.provider);
    const source = input.provider === 'jira' ? 'jira' : 'manual';

    const created: RequirementRow[] = [];
    for (const key of input.keys) {
      let item;
      try {
        item = await client.getItem(key);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Import failed');
      }
      if (!item) continue;

      const row = await this.tenantDb.run(async (tx) => {
        const [requirement] = await tx
          .insert(requirements)
          .values({
            organizationId,
            projectId,
            designId: input.designId ?? null,
            title: item.title.slice(0, 200),
            description: `Imported from ${input.provider} · [${item.key}](${item.url})`,
            source,
            createdBy: userId,
          })
          .returning();
        if (!requirement) throw new Error('requirement insert returned no row');
        await tx.insert(externalLinks).values({
          organizationId,
          provider: input.provider,
          entityType: 'requirement',
          entityId: requirement.id,
          externalKey: item.key,
          externalUrl: item.url,
          title: item.title,
          state: item.state ?? null,
          syncedAt: new Date(),
          createdBy: userId,
        });
        await this.audit.log(
          {
            action: 'INTEGRATION_IMPORTED',
            resourceType: 'requirement',
            resourceId: requirement.id,
            metadata: { provider: input.provider, key: item.key },
          },
          tx,
        );
        return requirement;
      });
      created.push(row);
    }

    return { imported: created.length, requirements: created.map(toRequirement) };
  }

  private async tryFetch(
    organizationId: string,
    provider: IntegrationProvider,
    key: string,
  ): Promise<{ url: string; title: string; state: string | null } | null> {
    try {
      const client = await this.integrations.clientFor(organizationId, provider);
      const item = await client.getItem(key);
      return item ? { url: item.url, title: item.title, state: item.state ?? null } : null;
    } catch (error) {
      // not connected / provider error → caller falls back to the raw key
      if (error instanceof IntegrationError || error instanceof NotFoundException) return null;
      return null;
    }
  }

  private async assertDesignInProject(
    organizationId: string,
    projectId: string,
    designId: string,
  ): Promise<void> {
    const found = await this.tenantDb.run((tx: Database) =>
      tx
        .select({ id: testDesigns.id })
        .from(testDesigns)
        .where(
          and(
            eq(testDesigns.organizationId, organizationId),
            eq(testDesigns.projectId, projectId),
            eq(testDesigns.id, designId),
          ),
        )
        .then((rows) => rows[0]),
    );
    if (!found) throw new NotFoundException('Design not found in this project');
  }
}

function toLink(row: LinkRow): ExternalLink {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    entityType: row.entityType,
    entityId: row.entityId,
    externalKey: row.externalKey,
    externalUrl: row.externalUrl,
    title: row.title,
    state: row.state,
    syncedAt: row.syncedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    source: row.source,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
