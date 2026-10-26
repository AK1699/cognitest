import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import type { IntegrationConnection, MeResponse, SessionListItem } from '@cognitest/shared';

import { apiGet } from '../../../lib/api';
import { IntegrationsPanel, type ConnectionView } from './integrations-panel';
import { ProfileTabs } from './profile-tabs';
import { SessionsPanel } from './sessions-panel';

export const metadata: Metadata = { title: 'Profile — Cognitest' };
export const dynamic = 'force-dynamic';

interface SessionsResponse {
  sessions: SessionListItem[];
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [me, sessions, integrations] = await Promise.all([
    apiGet<MeResponse>('/auth/me'),
    apiGet<SessionsResponse>('/auth/sessions'),
    apiGet<{ integrations: IntegrationConnection[] }>(
      `/organizations/${organizationId}/integrations`,
    ),
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

  const connections: ConnectionView[] = (integrations?.integrations ?? []).map((c) => ({
    provider: c.provider,
    status: c.status,
    accountLabel: c.accountLabel,
    config: c.config,
    lastError: c.lastError,
    lastVerifiedAt: c.lastVerifiedAt ? c.lastVerifiedAt.toString() : null,
  }));

  const integrationsPanel = (
    <IntegrationsPanel organizationId={organizationId} initialConnections={connections} />
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
      <ProfileTabs
        information={information}
        integrations={integrationsPanel}
        security={security}
      />
    </div>
  );
}
