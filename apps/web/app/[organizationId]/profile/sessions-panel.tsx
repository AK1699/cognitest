'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '../../toast';

interface SessionRow {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  current: boolean;
}

/** Active sessions with revoke actions — the interactive part of Security. */
export function SessionsPanel({ initialSessions }: { initialSessions: SessionRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function revoke(id: string) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not revoke the session — try again');
      toast.push('Session revoked', 'success');
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">Active sessions</h3>
      <ul className="divide-y divide-line">
        {initialSessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {session.userAgent ?? 'Unknown device'}
                {session.current && (
                  <span className="ml-2 rounded-full bg-pass-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pass">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                Last active{' '}
                {new Date(session.lastSeenAt ?? session.createdAt).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                onClick={() => void revoke(session.id)}
                disabled={pendingId === session.id}
                className="shrink-0 rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-fail-tint hover:text-fail disabled:opacity-60"
              >
                {pendingId === session.id ? 'Revoking…' : 'Revoke'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
