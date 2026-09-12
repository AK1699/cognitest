'use client';

import { signupRequestSchema } from '@cognitest/shared';

import { AuthForm, FormError, useAuthSubmit } from '../auth-form';
import { Field, PrimaryButton } from '../components';

export function SignupForm() {
  const { submit, error, pending } = useAuthSubmit();

  return (
    <AuthForm
      onSubmit={(fields) =>
        submit(
          '/api/auth/signup',
          {
            displayName: fields.displayName,
            username: fields.username,
            email: fields.email,
            password: fields.password,
          },
          '/onboarding',
          signupRequestSchema,
        )
      }
    >
      <FormError error={error} />
      <Field
        id="displayName"
        label="Display name"
        type="text"
        placeholder="Ada Lovelace"
        autoComplete="name"
      />
      <Field
        id="username"
        label="Username"
        type="text"
        placeholder="ada"
        autoComplete="username"
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
        placeholder="At least 12 characters"
        autoComplete="new-password"
      />
      <PrimaryButton>{pending ? 'Creating account…' : 'Create account'}</PrimaryButton>
    </AuthForm>
  );
}
