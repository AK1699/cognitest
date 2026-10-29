import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../../lib/api';
import { NewDesignWizard } from './new-design-wizard';

export const metadata: Metadata = { title: 'New Test Design — Cognitest' };
export const dynamic = 'force-dynamic';

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

export default async function NewDesignPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const projects = await apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`);

  return (
    <Suspense>
      <NewDesignWizard organizationId={organizationId} projects={projects?.projects ?? []} />
    </Suspense>
  );
}
