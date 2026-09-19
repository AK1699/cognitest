import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import type { MeResponse, SessionListItem } from '@cognitest/shared';

import { apiGet } from '../../../lib/api';
import { ProfileTabs } from './profile-tabs';
import { SessionsPanel } from './sessions-panel';

export const metadata: Metadata = { title: 'Profile — Cognitest' };
export const dynamic = 'force-dynamic';

interface SessionsResponse {
  sessions: SessionListItem[];
}

export default async function ProfilePage() {
  const [me, sessions] = await Promise.all([
    apiGet<MeResponse>('/auth/me'),
    apiGet<SessionsResponse>('/auth/sessions'),
  ]);
  if (!me) redirect('/login');

  const { user } = me;
  const initial = (user.displayName.trim().charAt(0) || '?').toUpperCase();

  const information = (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-deep text-xl font-bold text-white">
          {initial}
        </span>
        <div>
          <p className="text-lg font-bold text-ink">{user.displayName}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted">Username</dt>
          <dd className="font-semibold text-ink">{user.username ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">Account status</dt>
          <dd className="font-semibold text-ink">{user.status.replace(/_/g, ' ')}</dd>
        </div>
      </dl>
    </div>
  );

  const integrationCatalogue = [
    { name: 'JIRA', description: 'Link test cases to issues and sync defect status.' },
    { name: 'Bitbucket', description: 'Connect repositories to trace tests against commits.' },
    { name: 'GitHub', description: 'Connect repositories and pull requests to test runs.' },
    { name: 'Notion', description: 'Sync requirements and test documentation.' },
  ];

  const integrations = (
    <ul className="divide-y divide-line">
      {integrationCatalogue.map((integration) => (
        <li key={integration.name} className="flex items-center justify-between gap-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-ink">{integration.name}</p>
            <p className="text-xs text-muted">{integration.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary-tint px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-deep">
            Coming soon
          </span>
        </li>
      ))}
    </ul>
  );

  const security = (
    <div>
      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted">Email verified</dt>
          <dd className="font-semibold text-ink">{user.emailVerifiedAt ? 'Yes' : 'Not yet'}</dd>
        </div>
        <div>
          <dt className="text-muted">Two-factor authentication</dt>
          <dd className="font-semibold text-ink">{user.mfaEnabled ? 'Enabled' : 'Off'}</dd>
        </div>
      </dl>
      <SessionsPanel
        initialSessions={(sessions?.sessions ?? []).map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toString(),
          lastSeenAt: session.lastSeenAt?.toString() ?? null,
          current: session.current,
        }))}
      />
    </div>
  );

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Profile</h1>
      <ProfileTabs information={information} integrations={integrations} security={security} />
    </div>
  );
}
