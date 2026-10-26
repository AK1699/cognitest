'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { IntegrationProvider } from '@cognitest/shared';

import { Modal } from '../modal';
import { useToast } from '../../toast';

/** Plain, JSON-safe view of a connection (dates arrive as strings over HTTP). */
export interface ConnectionView {
  provider: IntegrationProvider;
  status: 'connected' | 'error';
  accountLabel: string | null;
  config: Record<string, string>;
  lastError: string | null;
  lastVerifiedAt: string | null;
}

interface FieldSpec {
  name: 'baseUrl' | 'email' | 'username' | 'workspace' | 'token';
  label: string;
  placeholder: string;
  required: boolean;
  secret?: boolean;
}

interface ProviderMeta {
  provider: IntegrationProvider;
  name: string;
  description: string;
  tokenHint: string;
  fields: FieldSpec[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    provider: 'jira',
    name: 'JIRA',
    description: 'Link test cases to issues and sync defect status.',
    tokenHint: 'Create an API token at id.atlassian.com → Security → API tokens.',
    fields: [
      { name: 'baseUrl', label: 'Site URL', placeholder: 'https://your-team.atlassian.net', required: true },
      { name: 'email', label: 'Account email', placeholder: 'you@company.com', required: true },
      { name: 'token', label: 'API token', placeholder: 'Paste your API token', required: true, secret: true },
    ],
  },
  {
    provider: 'bitbucket',
    name: 'Bitbucket',
    description: 'Connect repositories to trace tests against commits.',
    tokenHint: 'Use an app password with Account + Repositories (read) scopes.',
    fields: [
      { name: 'username', label: 'Username', placeholder: 'bitbucket-username', required: true },
      { name: 'workspace', label: 'Workspace (optional)', placeholder: 'your-workspace', required: false },
      { name: 'token', label: 'App password', placeholder: 'Paste your app password', required: true, secret: true },
    ],
  },
  {
    provider: 'github',
    name: 'GitHub',
    description: 'Connect repositories and pull requests to test runs.',
    tokenHint: 'Use a personal access token with repo (read) scope.',
    fields: [
      { name: 'baseUrl', label: 'API URL (optional)', placeholder: 'https://api.github.com', required: false },
      { name: 'token', label: 'Personal access token', placeholder: 'ghp_…', required: true, secret: true },
    ],
  },
  {
    provider: 'notion',
    name: 'Notion',
    description: 'Sync requirements and test documentation.',
    tokenHint: 'Create an internal integration and share the pages with it.',
    fields: [
      { name: 'token', label: 'Integration token', placeholder: 'ntn_…', required: true, secret: true },
    ],
  },
];

function StatusPill({ connection }: { connection?: ConnectionView }) {
  if (!connection) {
    return (
      <span className="shrink-0 rounded-full bg-cream px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
        Not connected
      </span>
    );
  }
  const ok = connection.status === 'connected';
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        ok ? 'bg-pass-tint text-pass' : 'bg-fail-tint text-fail'
      }`}
    >
      {ok ? 'Connected' : 'Error'}
    </span>
  );
}

export function IntegrationsPanel({
  organizationId,
  initialConnections,
}: {
  organizationId: string;
  initialConnections: ConnectionView[];
}) {
  const router = useRouter();
  const toast = useToast();
  const byProvider = new Map(initialConnections.map((c) => [c.provider, c]));

  const [editing, setEditing] = useState<ProviderMeta | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function openConnect(meta: ProviderMeta) {
    const existing = byProvider.get(meta.provider);
    // prefill non-secret config; never the token
    setForm(existing ? { ...existing.config } : {});
    setEditing(meta);
  }

  async function submit() {
    if (!editing) return;
    const missing = editing.fields.find((f) => f.required && !form[f.name]?.trim());
    if (missing) {
      toast.push(`${missing.label} is required`, 'error');
      return;
    }
    setBusy('save');
    try {
      const body: Record<string, string> = {};
      for (const field of editing.fields) {
        const value = form[field.name]?.trim();
        if (value) body[field.name] = value;
      }
      const res = await fetch(`/api/organizations/${organizationId}/integrations/${editing.provider}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { integration?: { status: string; lastError: string | null }; message?: unknown }
        | null;
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
        throw new Error(typeof msg === 'string' ? msg : 'Could not save the connection');
      }
      if (data?.integration?.status === 'error') {
        toast.push(data.integration.lastError ?? 'Connected, but verification failed', 'error');
      } else {
        toast.push(`${editing.name} connected`, 'success');
      }
      setEditing(null);
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function verify(provider: IntegrationProvider) {
    setBusy(`verify:${provider}`);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/integrations/${provider}/verify`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => null)) as
        | { integration?: { status: string; lastError: string | null } }
        | null;
      if (!res.ok) throw new Error('Verification request failed');
      if (data?.integration?.status === 'connected') toast.push('Connection verified', 'success');
      else toast.push(data?.integration?.lastError ?? 'Verification failed', 'error');
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: IntegrationProvider) {
    setBusy(`disconnect:${provider}`);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/integrations/${provider}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Could not disconnect');
      toast.push('Disconnected', 'success');
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {PROVIDERS.map((meta) => {
          const connection = byProvider.get(meta.provider);
          return (
            <li key={meta.provider} className="flex items-start justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{meta.name}</p>
                  <StatusPill connection={connection} />
                </div>
                <p className="text-xs text-muted">{meta.description}</p>
                {connection?.accountLabel && connection.status === 'connected' && (
                  <p className="mt-0.5 text-xs text-primary-deep">Signed in as {connection.accountLabel}</p>
                )}
                {connection?.status === 'error' && connection.lastError && (
                  <p className="mt-0.5 text-xs text-fail">{connection.lastError}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {connection && (
                  <button
                    type="button"
                    onClick={() => void verify(meta.provider)}
                    disabled={busy !== null}
                    className="rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint disabled:opacity-60"
                  >
                    {busy === `verify:${meta.provider}` ? 'Checking…' : 'Verify'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openConnect(meta)}
                  disabled={busy !== null}
                  className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
                >
                  {connection ? 'Edit' : 'Connect'}
                </button>
                {connection && (
                  <button
                    type="button"
                    onClick={() => void disconnect(meta.provider)}
                    disabled={busy !== null}
                    className="rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-fail-tint hover:text-fail disabled:opacity-60"
                  >
                    {busy === `disconnect:${meta.provider}` ? 'Removing…' : 'Disconnect'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <Modal title={`Connect ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            {editing.fields.map((field) => (
              <label key={field.name} className="block">
                <span className="mb-1 block text-xs font-semibold text-ink">{field.label}</span>
                <input
                  type={field.secret ? 'password' : 'text'}
                  value={form[field.name] ?? ''}
                  autoComplete={field.secret ? 'new-password' : 'off'}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                  className="w-full rounded-[10px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </label>
            ))}
            <p className="text-xs text-muted">{editing.tokenHint}</p>
            <p className="text-xs text-muted">
              Tokens are encrypted before storage and are never shown again after saving.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-tint"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy === 'save'}
                className="rounded-[10px] bg-accent px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
              >
                {busy === 'save' ? 'Saving…' : 'Save & verify'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
