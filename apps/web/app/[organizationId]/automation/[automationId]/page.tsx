import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../../lib/api';
import { AutomationWorkspace } from './automation-workspace';

export const metadata: Metadata = { title: 'Automation — Cognitest' };
export const dynamic = 'force-dynamic';

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; automationId: string }>;
}) {
  const { organizationId, automationId } = await params;
  const projects = await apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`);

  return (
    <Suspense>
      <AutomationWorkspace
        organizationId={organizationId}
        automationId={automationId}
        projects={projects?.projects ?? []}
      />
    </Suspense>
  );
}
