'use client';

import { useState } from 'react';

import { AuthForm, FormError } from '../auth-form';
import { Field, PrimaryButton } from '../components';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="text-sm text-ink">
        If that address has an account, a reset link is on its way. Check your inbox — the link is
        valid for one hour.
      </p>
    );
  }

  return (
    <AuthForm
      onSubmit={(fields) => {
        fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: fields.email }),
        })
          .then((res) => (res.ok ? setSent(true) : setError('Something went wrong — try again')))
          .catch(() => setError('Network error — is the API running?'));
      }}
    >
      <FormError error={error} />
      <Field
        id="email"
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
      />
      <PrimaryButton>Send reset link</PrimaryButton>
    </AuthForm>
  );
}
