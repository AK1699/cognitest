import type { Metadata } from 'next';
import Link from 'next/link';

import { apiGet } from '../../../lib/api';

export const metadata: Metadata = { title: 'Dashboard — Cognitest' };
export const dynamic = 'force-dynamic';

interface TeamsResponse {
  teams: { id: string; name: string; slug: string }[];
}
interface MembersResponse {
  members: { id: string; displayName: string; roleKey: string | null }[];
}
interface ProjectsResponse {
  projects: { id: string; key: string; name: string; status: string }[];
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [teams, members, projects] = await Promise.all([
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
    apiGet<MembersResponse>(`/organizations/${organizationId}/members`),
    apiGet<ProjectsResponse>(`/organizations/${organizationId}/projects`),
  ]);

  const stats = [
    { label: 'Projects', value: projects?.projects.length ?? 0, href: `/${organizationId}/design` },
    { label: 'Teams', value: teams?.teams.length ?? 0, href: `/${organizationId}/members` },
    { label: 'Members', value: members?.members.length ?? 0, href: `/${organizationId}/members` },
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-card border border-line bg-white p-6 transition-colors hover:border-primary"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="mt-2 text-4xl font-bold text-primary-deep">{stat.value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-6 rounded-card border border-line bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Projects</h2>
          <Link
            href={`/${organizationId}/design`}
            className="text-sm font-semibold text-accent hover:text-accent-deep"
          >
            Open Design →
          </Link>
        </div>
        {(projects?.projects.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">
            No projects yet — create the first one in the Design module.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {(projects?.projects ?? []).map((project) => (
              <li key={project.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="text-sm font-semibold text-ink">{project.name}</span>
                </div>
                <span className="text-xs text-muted">{project.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
