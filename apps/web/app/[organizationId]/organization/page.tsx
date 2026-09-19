import type { Metadata } from 'next';

import { apiGet } from '../../../lib/api';

export const metadata: Metadata = { title: 'Organisation — Cognitest' };
export const dynamic = 'force-dynamic';

interface OrganizationResponse {
  organization: { id: string; name: string; slug: string; onboardingStatus: string };
}
interface TeamsResponse {
  teams: { id: string; name: string; slug: string }[];
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [org, teams] = await Promise.all([
    apiGet<OrganizationResponse>(`/organizations/${organizationId}`),
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Organisation</h1>

      <section className="max-w-2xl rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="font-semibold text-ink">{org?.organization.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Slug</dt>
            <dd className="font-mono text-ink">{org?.organization.slug}</dd>
          </div>
          <div>
            <dt className="text-muted">Onboarding</dt>
            <dd className="font-semibold text-ink">{org?.organization.onboardingStatus}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 max-w-2xl rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Teams</h2>
        {(teams?.teams.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">No teams yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(teams?.teams ?? []).map((team) => (
              <li key={team.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-semibold text-ink">{team.name}</span>
                <span className="font-mono text-xs text-muted">{team.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
