import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import type { MeResponse } from '@cognitest/shared';

import { apiGet } from '../../../lib/api';
import { LogoutButton } from '../../logout-button';

export const metadata: Metadata = { title: 'Dashboard — Cognitest' };
export const dynamic = 'force-dynamic';

interface OrganizationResponse {
  organization: { id: string; name: string; slug: string; onboardingStatus: string };
}

interface TeamsResponse {
  teams: { id: string; name: string; slug: string }[];
}

interface MembersResponse {
  members: { id: string; displayName: string; email: string; roleKey: string | null }[];
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [me, org, teams, members] = await Promise.all([
    apiGet<MeResponse>('/auth/me'),
    apiGet<OrganizationResponse>(`/organizations/${organizationId}`),
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
    apiGet<MembersResponse>(`/organizations/${organizationId}/members`),
  ]);
  // non-members get a 404 from the API — send them home rather than erroring
  if (!me || !org) redirect('/');

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              {org.organization.slug}
            </p>
            <h1 className="text-3xl font-bold text-primary-deep">{org.organization.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{me.user.displayName}</span>
            <LogoutButton />
          </div>
        </header>

        {me.user.status === 'pending_verification' && (
          <p className="rounded-card border border-line bg-primary-tint px-4 py-3 text-sm text-ink">
            Check your inbox to verify your email address.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
              Teams ({teams?.teams.length ?? 0})
            </h2>
            <ul className="space-y-2 text-sm text-ink">
              {(teams?.teams ?? []).map((team) => (
                <li key={team.id} className="flex items-center justify-between">
                  <span className="font-semibold">{team.name}</span>
                  <span className="text-xs text-muted">{team.slug}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
              Members ({members?.members.length ?? 0})
            </h2>
            <ul className="space-y-2 text-sm text-ink">
              {(members?.members ?? []).slice(0, 8).map((member) => (
                <li key={member.id} className="flex items-center justify-between">
                  <span className="font-semibold">{member.displayName}</span>
                  <span className="text-xs text-muted">{member.roleKey ?? '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-card border border-line bg-white p-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Next up</h2>
          <p className="text-sm text-muted">
            Projects, test plans and executions land here as the product phase ships.
          </p>
        </section>
      </div>
    </main>
  );
}
