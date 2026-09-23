import type { Metadata } from 'next';
import { Suspense } from 'react';

import { apiGet } from '../../../lib/api';
import { ProjectsManager } from './projects-manager';

export const metadata: Metadata = { title: 'Projects — Cognitest' };
export const dynamic = 'force-dynamic';

interface ProjectsResponse {
  projects: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    status: string;
    teamId: string;
  }[];
}
interface TeamsResponse {
  teams: { id: string; name: string }[];
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [projects, teams] = await Promise.all([
    apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`),
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Projects</h1>
      <Suspense>
        <ProjectsManager
          organizationId={organizationId}
          initialProjects={projects?.projects ?? []}
          teams={(teams?.teams ?? []).map(({ id, name }) => ({ id, name }))}
        />
      </Suspense>
    </div>
  );
}
