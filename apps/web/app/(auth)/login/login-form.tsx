'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { AuthForm, FormError, useAuthSubmit } from '../auth-form';
import { Field, PrimaryButton } from '../components';

const OIDC_ERRORS: Record<string, string> = {
  account_exists:
    'An account with this email already exists — log in with your password to link it.',
  oidc_failed: 'Sign-in with the provider failed — try again.',
  oidc_denied: 'Sign-in was cancelled at the provider.',
};

export function LoginForm() {
  const { submit, error, pending } = useAuthSubmit();
  const params = useSearchParams();
  const redirectTo = params.get('redirectTo') ?? '/';
  const oidcError = OIDC_ERRORS[params.get('error') ?? ''] ?? null;

  return (
    <AuthForm
      onSubmit={(fields) =>
        submit('/api/auth/login', { email: fields.email, password: fields.password }, redirectTo)
      }
    >
      <FormError error={error ?? oidcError} />
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
          href="/forgot-password"
          className="self-end text-xs font-semibold text-accent hover:text-accent-deep"
        >
          Forgot password?
        </Link>
      </div>
      <PrimaryButton>{pending ? 'Logging in…' : 'Log in'}</PrimaryButton>
    </AuthForm>
  );
}
