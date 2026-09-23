'use client';

import { Plus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Modal } from '../modal';
import { useToast } from '../../toast';

interface OrganisationRow {
  id: string;
  name: string;
}

const inputClasses =
  'rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
const primaryButtonClasses =
  'cursor-pointer rounded-[10px] bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-60';
const ghostButtonClasses =
  'cursor-pointer rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint disabled:opacity-60';

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

export function OrganisationManager({
  organizationId,
  organizations,
}: {
  organizationId: string;
  organizations: OrganisationRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);

  async function createOrganisation(name: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // no default team — teams are created deliberately in the Teams section
        body: JSON.stringify({ name, defaultTeam: false }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { organization: { id: string } };
      toast.push('Organisation created', 'success');
      setCreatingOrg(false);
      router.push(`/${data.organization.id}/organization`);
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreatingOrg(true)}
          className={`${primaryButtonClasses} flex items-center gap-1.5`}
        >
          <Plus aria-hidden className="h-4 w-4" />
          New organisation
        </button>
      </div>

      {/* existing organisations */}
      <section className="rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
          Your organisations
        </h2>
        <ul className="divide-y divide-line">
          {organizations.map((org) => {
            const current = org.id === organizationId;
            return (
              <li key={org.id} className="flex items-center justify-between gap-4 py-3">
                <span
                  className={`text-sm font-semibold ${current ? 'text-primary-deep' : 'text-ink'}`}
                >
                  {org.name}
                </span>
                {current ? (
                  <span className="rounded-full bg-pass-tint px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pass">
                    Current
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/${org.id}/organization`)}
                    className={ghostButtonClasses}
                  >
                    Open
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {creatingOrg && (
        <Modal title="New organisation" onClose={() => setCreatingOrg(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
              if (name) void createOrganisation(name);
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Name
              <input name="name" required placeholder="e.g. Acme QA" className={inputClasses} />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreatingOrg(false)}
                className={ghostButtonClasses}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClasses}>
                {busy ? 'Creating…' : 'Create organisation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
