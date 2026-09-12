import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import type { MeResponse } from '@cognitest/shared';

import { apiGet } from '../../lib/api';
import { Sidebar } from './sidebar';

export const dynamic = 'force-dynamic';

interface OrganizationResponse {
  organization: { id: string; name: string };
}

/** App shell for every organization module: sidebar + scrollable content pane. */
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [me, org] = await Promise.all([
    apiGet<MeResponse>('/auth/me'),
    apiGet<OrganizationResponse>(`/organizations/${organizationId}`),
  ]);
  // non-members see a 404 from the API — bounce home rather than erroring
  if (!me || !org) redirect('/');

  return (
    <div className="flex min-h-screen">
      <Sidebar
        organizationId={organizationId}
        organizationName={org.organization.name}
        userName={me.user.displayName}
        userEmail={me.user.email}
      />
      <main className="flex-1 overflow-y-auto p-8">
        {me.user.status === 'pending_verification' && (
          <p className="mb-6 rounded-card border border-line bg-primary-tint px-4 py-3 text-sm text-ink">
            Check your inbox to verify your email address.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
