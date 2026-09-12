import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthHeading, AuthShell, Divider, SocialButtons } from '../components';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in — Cognitest' };

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthHeading title="Welcome back" subtitle="Log in to your Cognitest workspace" />
      <SocialButtons />
      <Divider />
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-accent hover:text-accent-deep">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
