'use client';

import { useState } from 'react';

interface InvitationRow {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
}

interface RoleOption {
  id: string;
  key: string;
  name: string;
}

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

export function InvitationsPanel({
  organizationId,
  initialInvitations,
  roles,
}: {
  organizationId: string;
  initialInvitations: InvitationRow[];
  roles: RoleOption[];
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(roles.find((r) => r.key === 'tester')?.id ?? roles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function invite() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invitations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), roleId }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const created = (await res.json()) as { invitation: InvitationRow };
      setInvitations((rows) => [created.invitation, ...rows]);
      setEmail('');
    } catch {
      setError('Network error — is the API running?');
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/organizations/${organizationId}/invitations/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setInvitations((rows) =>
        rows.map((row) => (row.id === id ? { ...row, status: 'revoked' } : row)),
      );
    }
  }

  return (
    <section className="mt-6 max-w-2xl rounded-card border border-line bg-white p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Invitations</h2>

      <form
        className="mb-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void invite();
        }}
      >
        <input
          type="email"
          required
          value={email}
          placeholder="teammate@company.com"
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <select
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          className="rounded-[10px] border border-line bg-white px-2.5 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Invite'}
        </button>
      </form>
      {error && (
        <p role="alert" className="mb-4 rounded-[10px] bg-fail-tint px-3.5 py-2.5 text-sm text-fail">
          {error}
        </p>
      )}

      {invitations.length === 0 ? (
        <p className="text-sm text-muted">No invitations yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{invitation.email}</p>
                <p className="text-xs text-muted">
                  expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    invitation.status === 'pending'
                      ? 'bg-primary-tint text-primary-deep'
                      : invitation.status === 'accepted'
                        ? 'bg-pass-tint text-pass'
                        : 'bg-fail-tint text-fail'
                  }`}
                >
                  {invitation.status}
                </span>
                {invitation.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void revoke(invitation.id)}
                    className="text-xs font-semibold text-muted hover:text-fail"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
