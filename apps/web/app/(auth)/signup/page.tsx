import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthHeading, AuthShell, Divider, SocialButtons } from '../components';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Sign up — Cognitest' };

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthHeading title="Create your account" subtitle="Start testing smarter with Cognitest" />
      <SocialButtons />
      <Divider />
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent hover:text-accent-deep">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
