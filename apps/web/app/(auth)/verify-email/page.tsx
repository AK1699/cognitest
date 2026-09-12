import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading, AuthShell } from '../components';
import { VerifyEmail } from './verify-email';

export const metadata: Metadata = { title: 'Verify email — Cognitest' };

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <AuthHeading title="Email verification" subtitle="Confirming your address" />
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}
