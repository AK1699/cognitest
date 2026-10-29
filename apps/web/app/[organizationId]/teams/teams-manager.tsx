'use client';

import { Plus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Modal } from '../modal';
import { Select } from '../select';
import { useToast } from '../../toast';

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  memberIds: string[];
}

interface ProjectRow {
  id: string;
  name: string;
  teamId: string | null;
}

interface MemberRow {
  userId: string;
  displayName: string;
}

const inputClasses =
  'rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
const primaryButtonClasses =
  'cursor-pointer rounded-[10px] bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-60';
const ghostButtonClasses =
  'cursor-pointer rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint disabled:opacity-60';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  return base.length > 0 ? base.slice(0, 48) : 'team';
}

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

export function TeamsManager({
  organizationId,
  teams,
  projects,
  organizationMembers,
}: {
  organizationId: string;
  teams: TeamRow[];
  projects: ProjectRow[];
  organizationMembers: MemberRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [deleting, setDeleting] = useState<TeamRow | null>(null);

  const base = `/api/organizations/${organizationId}/teams`;
  const nameOf = (userId: string) =>
    organizationMembers.find((member) => member.userId === userId)?.displayName ?? 'Unknown user';

  async function call(url: string, init: RequestInit, successMessage: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        ...init,
        headers: init.body ? { 'content-type': 'application/json' } : undefined,
      });
      if (!res.ok) throw new Error(await readError(res));
      setCreating(false);
      setEditing(null);
      setDeleting(null);
      toast.push(successMessage, 'success');
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`${primaryButtonClasses} flex items-center gap-1.5`}
        >
          <Plus aria-hidden className="h-4 w-4" />
          New team
        </button>
      </div>

      {teams.length === 0 ? (
        <section className="rounded-card border border-line bg-white p-6">
          <p className="text-sm text-muted">No teams yet — create the first one.</p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const teamProjects = projects.filter((project) => project.teamId === team.id);
            const nonMembers = organizationMembers.filter(
              (member) => !team.memberIds.includes(member.userId),
            );
            return (
              <article key={team.id} className="rounded-card border border-line bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-ink">{team.name}</h2>
                    <span className="font-mono text-xs text-muted">{team.slug}</span>
                  </div>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(team)}
                      className={ghostButtonClasses}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (teamProjects.length > 0) {
                          toast.push('Move or delete this team’s projects first', 'error');
                          return;
                        }
                        setDeleting(team);
                      }}
                      className={`${ghostButtonClasses} hover:bg-fail-tint hover:text-fail`}
                    >
                      Delete
                    </button>
                  </span>
                </div>

                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                  Projects
                </p>
                <p className="mb-3 text-sm text-ink">
                  {teamProjects.length === 0
                    ? 'None yet'
                    : teamProjects.map((project) => project.name).join(', ')}
                </p>

                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Members</p>
                {team.memberIds.length === 0 ? (
                  <p className="mb-3 text-sm text-muted">None yet</p>
                ) : (
                  <ul className="mb-3 space-y-1">
                    {team.memberIds.map((userId) => (
                      <li key={userId} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-ink">{nameOf(userId)}</span>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Remove ${nameOf(userId)} from ${team.name}`}
                          onClick={() =>
                            void call(
                              `${base}/${team.id}/members/${userId}`,
                              { method: 'DELETE' },
                              'Member removed from team',
                            )
                          }
                          className="cursor-pointer text-xs text-muted hover:text-fail"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {nonMembers.length > 0 && (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const userId = String(new FormData(event.currentTarget).get('userId') ?? '');
                      if (userId) {
                        void call(
                          `${base}/${team.id}/members`,
                          { method: 'POST', body: JSON.stringify({ userId }) },
                          'Member added to team',
                        );
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <Select
                        name="userId"
                        options={nonMembers.map((member) => ({
                          value: member.userId,
                          label: member.displayName,
                        }))}
                      />
                    </div>
                    <button type="submit" disabled={busy} className={ghostButtonClasses}>
                      Add
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}

      {creating && (
        <Modal title="New team" onClose={() => setCreating(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
              if (name) {
                void call(
                  base,
                  { method: 'POST', body: JSON.stringify({ name, slug: slugify(name) }) },
                  'Team created',
                );
              }
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Name
              <input name="name" required placeholder="e.g. Platform" className={inputClasses} />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={ghostButtonClasses}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClasses}>
                {busy ? 'Creating…' : 'Create team'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
              if (name) {
                void call(
                  `${base}/${editing.id}`,
                  { method: 'PATCH', body: JSON.stringify({ name }) },
                  'Team updated',
                );
              }
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Name
              <input name="name" required defaultValue={editing.name} className={inputClasses} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={ghostButtonClasses}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClasses}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete ${deleting.name}`} onClose={() => setDeleting(null)}>
          <p className="text-sm text-ink">
            Delete the team <span className="font-semibold">{deleting.name}</span>? Its members lose
            the team grouping. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className={ghostButtonClasses}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void call(`${base}/${deleting.id}`, { method: 'DELETE' }, 'Team deleted')
              }
              className="cursor-pointer rounded-[10px] bg-fail px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Delete team'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
