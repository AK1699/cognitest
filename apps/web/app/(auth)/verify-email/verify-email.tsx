'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type State = 'verifying' | 'success' | 'failed' | 'missing';

export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => !cancelled && setState(res.ok ? 'success' : 'failed'))
      .catch(() => !cancelled && setState('failed'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'verifying') return <p className="text-sm text-muted">Verifying your email…</p>;
  if (state === 'success') {
    return (
      <div className="flex flex-col gap-4 text-sm text-ink">
        <p>Your email is verified — you&apos;re all set.</p>
        <Link href="/" className="font-semibold text-accent hover:text-accent-deep">
          Go to your workspace →
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 text-sm text-ink">
      <p>
        {state === 'missing'
          ? 'This link is missing its verification token.'
          : 'This verification link is invalid or has expired.'}
      </p>
      <p className="text-muted">
        Log in and request a new verification email from your account page, or{' '}
        <Link href="/login" className="font-semibold text-accent hover:text-accent-deep">
          go to login
        </Link>
        .
      </p>
    </div>
  );
}
