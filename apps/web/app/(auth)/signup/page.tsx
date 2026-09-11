import type { Metadata } from 'next';
import Link from 'next/link';

import {
  AuthHeading,
  AuthShell,
  Divider,
  Field,
  PrimaryButton,
  SocialButtons,
} from '../components';

export const metadata: Metadata = { title: 'Sign up — Cognitest' };

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthHeading title="Create your account" subtitle="Start testing smarter with Cognitest" />
      <SocialButtons />
      <Divider />
      {/* no auth backend yet — form is presentational */}
      <form className="flex flex-col gap-4">
        <Field
          id="displayName"
          label="Display name"
          type="text"
          placeholder="Ada Lovelace"
          autoComplete="name"
        />
        <Field
          id="email"
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
        <PrimaryButton>Create account</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent hover:text-accent-deep">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
