import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import type { MeResponse } from '@cognitest/shared';

import { Suspense } from 'react';

import { apiGet, getMyOrganizations } from '../../lib/api';
import { ActiveContext } from './active-context';
import { EnvironmentSwitcher } from './environment-switcher';
import { OrgSwitcher, Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

export const dynamic = 'force-dynamic';

interface OrganizationResponse {
  organization: { id: string; name: string };
}

interface TeamsResponse {
  teams: { id: string; name: string }[];
}

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string; teamId: string }[];
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
  const [me, org, memberships, teams, projects] = await Promise.all([
    apiGet<MeResponse>('/auth/me'),
    apiGet<OrganizationResponse>(`/organizations/${organizationId}`),
    getMyOrganizations(),
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
    apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`),
  ]);
  // non-members see a 404 from the API — bounce home rather than erroring
  if (!me || !org) redirect('/');

  return (
    <div className="flex min-h-screen">
      <Sidebar organizationId={organizationId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-8 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 max-w-xl">
              <Suspense>
                <OrgSwitcher
                  organizationId={organizationId}
                  organizationName={org.organization.name}
                  organizations={(memberships ?? []).map((m) => ({
                    id: m.organization.id,
                    name: m.organization.name,
                  }))}
                  teams={(teams?.teams ?? []).map(({ id, name }) => ({ id, name }))}
                  projects={(projects?.projects ?? []).map(({ id, key, name, status }) => ({
                    id,
                    key,
                    name,
                    status,
                  }))}
                  context={
                    <Suspense>
                      <ActiveContext
                        organizationId={organizationId}
                        teams={(teams?.teams ?? []).map(({ id, name }) => ({ id, name }))}
                        projects={projects?.projects ?? []}
                      />
                    </Suspense>
                  }
                />
              </Suspense>
            </div>
            <EnvironmentSwitcher />
          </div>
          <UserMenu
            organizationId={organizationId}
            userName={me.user.displayName}
            userEmail={me.user.email}
          />
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
