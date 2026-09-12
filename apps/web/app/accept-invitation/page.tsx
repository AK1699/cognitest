import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading, AuthShell } from '../(auth)/components';
import { AcceptInvitation } from './accept-invitation';

export const metadata: Metadata = { title: 'Accept invitation — Cognitest' };

export default function AcceptInvitationPage() {
  return (
    <AuthShell>
      <AuthHeading title="Workspace invitation" subtitle="Joining an organization" />
      <Suspense>
        <AcceptInvitation />
      </Suspense>
    </AuthShell>
  );
}
