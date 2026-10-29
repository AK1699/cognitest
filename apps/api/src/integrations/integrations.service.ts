import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import {
  INTEGRATION_PROVIDERS,
  type ConnectIntegrationRequest,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationSearchResult,
} from '@cognitest/shared';

import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../auth/services/crypto.service';
import { integrationConnections } from '../db/schema';
import { TenantDb } from '../db/tenant-db.service';
import type { Database } from '../db/db.tokens';
import {
  IntegrationError,
  createProviderClient,
  splitConnectInput,
  type ProviderCredentials,
} from './providers';

type ConnectionRow = typeof integrationConnections.$inferSelect;

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
  ) {}

  /** Narrows a path param to a known provider or 404s — providers aren't tenant data. */
  assertProvider(provider: string): IntegrationProvider {
    if (!(INTEGRATION_PROVIDERS as readonly string[]).includes(provider)) {
      throw new NotFoundException('Unknown integration provider');
    }
    return provider as IntegrationProvider;
  }

  async list(organizationId: string): Promise<IntegrationConnection[]> {
    const rows = await this.tenantDb.run((tx) =>
      tx
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.organizationId, organizationId)),
    );
    return rows.map(toPublic);
  }

  async get(organizationId: string, provider: IntegrationProvider): Promise<IntegrationConnection> {
    const row = await this.tenantDb.run((tx) => this.findRow(tx, organizationId, provider));
    if (!row) throw new NotFoundException('Integration not connected');
    return toPublic(row);
  }

  /**
   * Stores (or replaces) the credentials for a provider and verifies them live.
   * A failed verify does NOT reject the request — the row is saved with
   * status='error' + the message, so the user can see and fix it.
   */
  async connect(
    organizationId: string,
    userId: string,
    provider: IntegrationProvider,
    input: ConnectIntegrationRequest,
  ): Promise<IntegrationConnection> {
    let config: Record<string, string>;
    let credentials: ProviderCredentials;
    try {
      ({ config, credentials } = splitConnectInput(provider, input));
    } catch (error) {
      throw new BadRequestException(messageOf(error));
    }

    let status: 'connected' | 'error' = 'connected';
    let accountLabel: string | null = null;
    let lastError: string | null = null;
    let lastVerifiedAt: Date | null = new Date();
    try {
      const result = await createProviderClient(provider, credentials).verify();
      accountLabel = result.accountLabel;
    } catch (error) {
      status = 'error';
      lastError = messageOf(error);
      lastVerifiedAt = null;
    }

    const secretEncrypted = this.crypto.encrypt(input.token);
    const row = await this.tenantDb.run(async (tx) => {
      const [saved] = await tx
        .insert(integrationConnections)
        .values({
          organizationId,
          provider,
          status,
          config,
          secretEncrypted,
          accountLabel,
          lastError,
          lastVerifiedAt,
          createdBy: userId,
        })
        .onConflictDoUpdate({
          target: [integrationConnections.organizationId, integrationConnections.provider],
          set: { status, config, secretEncrypted, accountLabel, lastError, lastVerifiedAt, updatedAt: new Date() },
        })
        .returning();
      if (!saved) throw new Error('integration insert returned no row');
      await this.audit.log(
        {
          action: 'INTEGRATION_CONNECTED',
          resourceType: 'integration',
          resourceId: saved.id,
          metadata: { provider, status },
        },
        tx,
      );
      return saved;
    });
    return toPublic(row);
  }

  /** Re-checks stored credentials and refreshes status/accountLabel. */
  async verify(
    organizationId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationConnection> {
    const row = await this.tenantDb.run((tx) => this.findRow(tx, organizationId, provider));
    if (!row) throw new NotFoundException('Integration not connected');

    let status: 'connected' | 'error' = 'connected';
    let accountLabel: string | null = row.accountLabel;
    let lastError: string | null = null;
    let lastVerifiedAt: Date | null = new Date();
    try {
      const result = await createProviderClient(provider, this.credentialsOf(row)).verify();
      accountLabel = result.accountLabel;
    } catch (error) {
      status = 'error';
      lastError = messageOf(error);
      lastVerifiedAt = null;
    }

    const [updated] = await this.tenantDb.run((tx) =>
      tx
        .update(integrationConnections)
        .set({ status, accountLabel, lastError, lastVerifiedAt, updatedAt: new Date() })
        .where(eq(integrationConnections.id, row.id))
        .returning(),
    );
    if (!updated) throw new NotFoundException('Integration not connected');
    return toPublic(updated);
  }

  async disconnect(organizationId: string, provider: IntegrationProvider): Promise<void> {
    await this.tenantDb.run(async (tx) => {
      const [deleted] = await tx
        .delete(integrationConnections)
        .where(
          and(
            eq(integrationConnections.organizationId, organizationId),
            eq(integrationConnections.provider, provider),
          ),
        )
        .returning({ id: integrationConnections.id });
      if (!deleted) throw new NotFoundException('Integration not connected');
      await this.audit.log(
        {
          action: 'INTEGRATION_DISCONNECTED',
          resourceType: 'integration',
          resourceId: deleted.id,
          metadata: { provider },
        },
        tx,
      );
    });
  }

  async search(
    organizationId: string,
    provider: IntegrationProvider,
    query: string,
  ): Promise<IntegrationSearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const client = await this.clientFor(organizationId, provider);
    try {
      return await client.search(q);
    } catch (error) {
      throw new BadRequestException(messageOf(error));
    }
  }

  /** Builds a live client for a connected provider or 404s. Used by links/import too. */
  async clientFor(organizationId: string, provider: IntegrationProvider) {
    const row = await this.tenantDb.run((tx) => this.findRow(tx, organizationId, provider));
    if (!row) throw new NotFoundException(`${provider} is not connected`);
    return createProviderClient(provider, this.credentialsOf(row));
  }

  private findRow(
    tx: Database,
    organizationId: string,
    provider: IntegrationProvider,
  ): Promise<ConnectionRow | undefined> {
    return tx
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, provider),
        ),
      )
      .then((rows) => rows[0]);
  }

  private credentialsOf(row: ConnectionRow): ProviderCredentials {
    const config = row.config ?? {};
    return {
      token: this.crypto.decrypt(row.secretEncrypted),
      baseUrl: config.baseUrl,
      email: config.email,
      username: config.username,
      workspace: config.workspace,
    };
  }
}

/** Public projection — the encrypted secret never crosses this boundary. */
function toPublic(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    status: row.status,
    config: row.config ?? {},
    accountLabel: row.accountLabel,
    lastError: row.lastError,
    lastVerifiedAt: row.lastVerifiedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function messageOf(error: unknown): string {
  if (error instanceof IntegrationError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong talking to the provider.';
}
