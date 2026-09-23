import type { Metadata } from 'next';

import { getMyOrganizations } from '../../../lib/api';
import { OrganisationManager } from './organisation-manager';

export const metadata: Metadata = { title: 'Organisation — Cognitest' };
export const dynamic = 'force-dynamic';

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const memberships = await getMyOrganizations();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Organisation</h1>

      <OrganisationManager
        organizationId={organizationId}
        organizations={(memberships ?? []).map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
        }))}
      />
    </div>
  );
}
