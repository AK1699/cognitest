import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import type { MeResponse } from '@cognitest/shared';

import { apiGet, getMyOrganizations } from '../../lib/api';
import { Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

export const dynamic = 'force-dynamic';

interface OrganizationResponse {
  organization: { id: string; name: string };
}

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

/** App shell for every organization module: sidebar + scrollable content pane. */
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [me, org, memberships, projects] = await Promise.all([
    apiGet<MeResponse>('/auth/me'),
    apiGet<OrganizationResponse>(`/organizations/${organizationId}`),
    getMyOrganizations(),
    apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`),
  ]);
  // non-members see a 404 from the API — bounce home rather than erroring
  if (!me || !org) redirect('/');

  return (
    <div className="flex min-h-screen">
      <Sidebar
        organizationId={organizationId}
        organizationName={org.organization.name}
        organizations={(memberships ?? []).map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
        }))}
        projects={(projects?.projects ?? []).map(({ id, key, name }) => ({ id, key, name }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-line bg-white px-8 py-3">
          <UserMenu userName={me.user.displayName} userEmail={me.user.email} />
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {me.user.status === 'pending_verification' && (
            <p className="mb-6 rounded-card border border-line bg-primary-tint px-4 py-3 text-sm text-ink">
              Check your inbox to verify your email address.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
