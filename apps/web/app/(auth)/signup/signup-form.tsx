'use client';

import { useState } from 'react';

import { PASSWORD_RULES, signupRequestSchema } from '@cognitest/shared';

import { AuthForm, useAuthSubmit } from '../auth-form';
import { Field, PrimaryButton } from '../components';

function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul aria-live="polite" className="-mt-1 space-y-1 px-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${met ? 'text-pass' : 'text-muted'}`}
          >
            <span aria-hidden>{met ? '✓' : '○'}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

export function SignupForm() {
  const { submit, pending } = useAuthSubmit();
  const [password, setPassword] = useState('');

  return (
    <AuthForm
      onSubmit={(fields) =>
        submit(
          '/api/auth/signup',
          {
            email: fields.email,
            password: fields.password,
          },
          '/onboarding',
          signupRequestSchema,
        )
      }
    >
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
        placeholder="Create a password"
        autoComplete="new-password"
        onChange={setPassword}
      />
      <PasswordChecklist password={password} />
      <PrimaryButton>{pending ? 'Creating account…' : 'Create account'}</PrimaryButton>
    </AuthForm>
  );
}
