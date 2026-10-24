import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../lib/api';
import { DesignLanding } from './design-landing';

export const metadata: Metadata = { title: 'Design — Cognitest' };
export const dynamic = 'force-dynamic';

interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

export default async function DesignPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const projects = await apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`);

  return (
    <Suspense>
      <DesignLanding organizationId={organizationId} projects={projects?.projects ?? []} />
    </Suspense>
  );
}
