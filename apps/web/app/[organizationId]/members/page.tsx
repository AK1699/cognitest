import type { Metadata } from 'next';

import { apiGet } from '../../../lib/api';
import { InviteMember } from './invite-member';

export const metadata: Metadata = { title: 'Members — Cognitest' };
export const dynamic = 'force-dynamic';

interface MembersResponse {
  members: {
    id: string;
    displayName: string;
    email: string;
    roleKey: string | null;
    status: string;
    joinedAt: string;
  }[];
}
interface TeamsResponse {
  teams: { id: string; name: string; slug: string }[];
}
interface RolesResponse {
  roles: { id: string; key: string; name: string; isSystem: boolean }[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  tester: 'Tester',
  business_analyst: 'Business Analyst',
  developer: 'Developer',
  viewer: 'Viewer',
};

export default async function MembersPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [members, teams, roles] = await Promise.all([
    apiGet<MembersResponse>(`/organizations/${organizationId}/members`),
    apiGet<TeamsResponse>(`/organizations/${organizationId}/teams`),
    // 403 without role.read → null → invite button hidden
    apiGet<RolesResponse>(`/organizations/${organizationId}/roles`),
  ]);
  const inviteRoles = (roles?.roles ?? []).filter((role) => role.isSystem && role.key !== 'admin');

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Members</h1>

      {inviteRoles.length > 0 && (
        <div className="mb-4 flex items-center justify-end">
          <InviteMember
            organizationId={organizationId}
            roles={inviteRoles.map(({ id, key, name }) => ({ id, key, name }))}
          />
        </div>
      )}

      <section className="rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
          People ({members?.members.length ?? 0})
        </h2>
        <ul className="divide-y divide-line">
          {(members?.members ?? []).map((member) => (
            <li key={member.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{member.displayName}</p>
                <p className="text-xs text-muted">{member.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary-deep">
                  {ROLE_LABELS[member.roleKey ?? ''] ?? member.roleKey ?? '—'}
                </p>
                {member.status !== 'active' && <p className="text-xs text-fail">{member.status}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
          Teams ({teams?.teams.length ?? 0})
        </h2>
        <ul className="divide-y divide-line">
          {(teams?.teams ?? []).map((team) => (
            <li key={team.id} className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-ink">{team.name}</span>
              <span className="text-xs text-muted">{team.slug}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
