import type { Metadata } from 'next';

import { apiGet } from '../../../lib/api';
import { TeamsManager } from './teams-manager';

export const metadata: Metadata = { title: 'Teams — Cognitest' };
export const dynamic = 'force-dynamic';

interface TeamsResponse {
  teams: { id: string; name: string; slug: string }[];
}
interface ProjectsResponse {
  projects: { id: string; name: string; teamId: string | null }[];
}
interface MembersResponse {
  members: { userId: string; displayName: string }[];
}
interface TeamMembersResponse {
  members: { userId: string }[];
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [teams, projects, members] = await Promise.all([
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
    apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`),
    apiGet<MembersResponse>(`/organizations/${organizationId}/members`),
  ]);

  const teamCards = await Promise.all(
    (teams?.teams ?? []).map(async (team) => {
      const teamMembers = await apiGet<TeamMembersResponse>(
        `/organizations/${organizationId}/teams/${team.id}/members`,
      );
      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        memberIds: (teamMembers?.members ?? []).map((member) => member.userId),
      };
    }),
  );

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Teams</h1>
      <TeamsManager
        organizationId={organizationId}
        teams={teamCards}
        projects={(projects?.projects ?? []).map(({ id, name, teamId }) => ({ id, name, teamId }))}
        organizationMembers={(members?.members ?? []).map(({ userId, displayName }) => ({
          userId,
          displayName,
        }))}
      />
    </div>
  );
}
