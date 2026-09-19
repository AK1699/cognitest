'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type State = { kind: 'accepting' } | { kind: 'missing' } | { kind: 'failed'; message: string };

/**
 * Runs behind the auth middleware: anonymous visitors are bounced to /login
 * with this URL (token included) as redirectTo, so the accept happens once
 * they're signed in. The invitation must match the logged-in email.
 */
export function AcceptInvitation() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [state, setState] = useState<State>(token ? { kind: 'accepting' } : { kind: 'missing' });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async (res) => {
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { organizationId: string };
        router.push(`/${data.organizationId}/dashboard`);
        router.refresh();
        return;
      }
      const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
      setState({
        kind: 'failed',
        message:
          typeof payload?.message === 'string'
            ? payload.message
            : 'This invitation is invalid or has expired.',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (state.kind === 'accepting') {
    return <p className="text-sm text-muted">Accepting your invitation…</p>;
  }
  return (
    <div className="flex flex-col gap-4 text-sm text-ink">
      <p>
        {state.kind === 'missing' ? 'This link is missing its invitation token.' : state.message}
      </p>
      <p className="text-muted">
        Ask your admin to send a new invitation, or{' '}
        <Link href="/" className="font-semibold text-accent hover:text-accent-deep">
          go to your workspace
        </Link>
        .
      </p>
    </div>
  );
}
