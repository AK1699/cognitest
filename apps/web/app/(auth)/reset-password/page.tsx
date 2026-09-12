import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading, AuthShell } from '../components';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Reset password — Cognitest' };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading title="Choose a new password" subtitle="At least 12 characters" />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
