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

export const metadata: Metadata = { title: 'Log in — Cognitest' };

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthHeading title="Welcome back" subtitle="Log in to your Cognitest workspace" />
      <SocialButtons />
      <Divider />
      {/* no auth backend yet — form is presentational */}
      <form className="flex flex-col gap-4">
        <Field
          id="email"
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
        />
        <div className="flex flex-col gap-1.5">
          <Field
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••••"
            autoComplete="current-password"
          />
          <Link
            href="#"
            className="self-end text-xs font-semibold text-accent hover:text-accent-deep"
          >
            Forgot password?
          </Link>
        </div>
        <PrimaryButton>Log in</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-accent hover:text-accent-deep">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
