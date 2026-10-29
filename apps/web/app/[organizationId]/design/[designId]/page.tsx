import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../../lib/api';
import { DesignWorkspace } from './design-workspace';

export const metadata: Metadata = { title: 'Test Design — Cognitest' };
export const dynamic = 'force-dynamic';

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; designId: string }>;
}) {
  const { organizationId, designId } = await params;
  const projects = await apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`);

  return (
    <Suspense>
      <DesignWorkspace
        organizationId={organizationId}
        designId={designId}
        projects={projects?.projects ?? []}
      />
    </Suspense>
  );
}
