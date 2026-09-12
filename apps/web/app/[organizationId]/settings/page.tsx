import type { Metadata } from 'next';

import { apiGet } from '../../../lib/api';
import { InvitationsPanel } from './invitations-panel';

export const metadata: Metadata = { title: 'Settings — Cognitest' };
export const dynamic = 'force-dynamic';

interface OrganizationResponse {
  organization: { id: string; name: string; slug: string; onboardingStatus: string };
}
interface InvitationsResponse {
  invitations: {
    id: string;
    email: string;
    status: string;
    expiresAt: string;
  }[];
}
interface RolesResponse {
  roles: { id: string; key: string; name: string; isSystem: boolean }[];
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [org, invitations, roles] = await Promise.all([
    apiGet<OrganizationResponse>(`/organizations/${organizationId}`),
    // 403 for roles without invitation.read → null → panel hidden
    apiGet<InvitationsResponse>(`/organizations/${organizationId}/invitations`),
    apiGet<RolesResponse>(`/organizations/${organizationId}/roles`),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Settings</h1>

      <section className="max-w-2xl rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Organization</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="font-semibold text-ink">{org?.organization.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Slug</dt>
            <dd className="font-mono text-ink">{org?.organization.slug}</dd>
          </div>
        </dl>
      </section>

      {invitations && (
        <InvitationsPanel
          organizationId={organizationId}
          initialInvitations={invitations.invitations}
          roles={(roles?.roles ?? []).filter((role) => role.isSystem && role.key !== 'admin')}
        />
      )}
    </div>
  );
}
