import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../../lib/api';
import { NewAutomationWizard } from './new-automation-wizard';

export const metadata: Metadata = { title: 'New Automation — Cognitest' };
export const dynamic = 'force-dynamic';

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

export default async function NewAutomationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const projects = await apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`);

  return (
    <Suspense>
      <NewAutomationWizard organizationId={organizationId} projects={projects?.projects ?? []} />
    </Suspense>
  );
}
