'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { resetPasswordRequestSchema } from '@cognitest/shared';

import { AuthForm, FormError, useAuthSubmit } from '../auth-form';
import { Field, PrimaryButton } from '../components';

export function ResetPasswordForm() {
  const { submit, error, pending } = useAuthSubmit();
  const token = useSearchParams().get('token');

  if (!token) {
    return (
      <p className="text-sm text-ink">
        This link is missing its reset token —{' '}
        <Link href="/forgot-password" className="font-semibold text-accent hover:text-accent-deep">
          request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <AuthForm
      onSubmit={(fields) =>
        submit(
          '/api/auth/reset-password',
          { token, password: fields.password },
          '/login',
          resetPasswordRequestSchema,
        )
      }
    >
      <FormError error={error} />
      <Field
        id="password"
        label="New password"
        type="password"
        placeholder="At least 12 characters"
        autoComplete="new-password"
      />
      <PrimaryButton>{pending ? 'Saving…' : 'Set new password'}</PrimaryButton>
    </AuthForm>
  );
}
