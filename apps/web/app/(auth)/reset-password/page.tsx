import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading, AuthShell } from '../components';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Reset password — Cognitest' };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading
        title="Choose a new password"
        subtitle="Use upper and lower case, a number and a special character"
      />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
