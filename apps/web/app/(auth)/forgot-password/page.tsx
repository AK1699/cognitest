import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthHeading, AuthShell } from '../components';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Forgot password — Cognitest' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading
        title="Reset your password"
        subtitle="We'll email you a link to choose a new one"
      />
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-accent hover:text-accent-deep">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
