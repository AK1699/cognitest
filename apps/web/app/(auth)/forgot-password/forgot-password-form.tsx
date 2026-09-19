'use client';

import { useState } from 'react';

import { AuthForm } from '../auth-form';
import { Field, PrimaryButton } from '../components';
import { useToast } from '../../toast';

export function ForgotPasswordForm() {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const setError = (message: string) => toast.push(message, 'error');

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
