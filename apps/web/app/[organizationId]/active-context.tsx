'use client';

import { useActiveProject } from './use-active-project';

interface ProjectOption {
  id: string;
  key: string;
  name: string;
  status: string;
  teamId: string | null;
}

interface TeamOption {
  id: string;
  name: string;
}

/**
 * Header breadcrumb tail: "/ team / project". The project is the one selected
 * in the URL (?project=, e.g. inside Design), falling back to the first active
 * project; the team is the active project's team (org > team > project).
 */
export function ActiveContext({
  organizationId,
  teams,
  projects,
}: {
  organizationId: string;
  teams: TeamOption[];
  projects: ProjectOption[];
}) {
  const [project] = useActiveProject(organizationId, projects);
  // team segment only when the active project has an owning team
  const teamName = project?.teamId
    ? (teams.find((team) => team.id === project.teamId)?.name ?? null)
    : null;

  if (!teamName && !project) return null;

  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
      {teamName && (
        <>
          <span aria-hidden>/</span>
          <span className="truncate font-semibold text-ink">{teamName}</span>
        </>
      )}
      {project && (
        <>
          <span aria-hidden>/</span>
          <span className="truncate font-semibold text-ink">{project.name}</span>
        </>
      )}
    </span>
  );
}
