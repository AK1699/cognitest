import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../lib/api';
import { DesignBoard } from './design-board';

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
    <div>
      <h1 className="mb-2 text-3xl font-bold text-primary-deep">Design</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Requirements become test plans; plans are reviewed and approved per version, then broken
        down into suites and cases.
      </p>
      <Suspense>
        <DesignBoard organizationId={organizationId} initialProjects={projects?.projects ?? []} />
      </Suspense>
    </div>
  );
}
