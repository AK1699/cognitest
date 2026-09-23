'use client';

import { Plus } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Select } from '../select';
import { useToast } from '../../toast';
import { useActiveProject } from '../use-active-project';

interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  teamId: string | null;
}

interface Team {
  id: string;
  name: string;
}

const inputClasses =
  'rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
const primaryButtonClasses =
  'rounded-[10px] bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-60';
const ghostButtonClasses =
  'rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint disabled:opacity-60';

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

function ProjectFormFields({
  teams,
  defaults,
}: {
  teams: Team[];
  defaults?: { name: string; description: string | null; teamId: string | null };
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Name
        <input
          name="name"
          required
          defaultValue={defaults?.name}
          placeholder="e.g. Mobile App"
          className={inputClasses}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ''}
          placeholder="What this project covers (optional)"
          className={`${inputClasses} resize-y`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Team
        <Select
          name="teamId"
          defaultValue={defaults?.teamId ?? ''}
          options={[
            { value: '', label: 'No team' },
            ...teams.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
      </label>
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-card border border-line bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-primary-deep">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ProjectsManager({
  organizationId,
  initialProjects,
  teams,
}: {
  organizationId: string;
  initialProjects: Project[];
  teams: Team[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const base = `/api/organizations/${organizationId}/projects`;

  const [activeProject, setActiveProject] = useActiveProject(organizationId, initialProjects);
  const activeProjectId = activeProject?.id ?? null;
  const teamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name ?? '—';

  async function call(url: string, init: RequestInit, successMessage?: string) {
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
      if (successMessage) toast.push(successMessage, 'success');
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  function formPayload(form: FormData) {
    const description = String(form.get('description') ?? '').trim();
    return {
      name: String(form.get('name') ?? '').trim(),
      description: description || null,
      teamId: String(form.get('teamId') ?? '') || null,
    };
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
          New project
        </button>
      </div>

      <section className="rounded-card border border-line bg-white p-6">
        {initialProjects.length === 0 ? (
          <p className="text-sm text-muted">No projects yet — create the first one.</p>
        ) : (
          <ul className="divide-y divide-line">
            {initialProjects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-3 py-4">
                <button
                  type="button"
                  onClick={() => setActiveProject(project.id)}
                  title="Set as active project"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-[8px] px-2 py-1 text-left transition-colors hover:bg-primary-tint/40"
                >
                  <span className="truncate text-sm text-muted">
                    {project.teamId && (
                      <>
                        {teamName(project.teamId)} <span aria-hidden>/</span>{' '}
                      </>
                    )}
                    <span className="font-semibold text-ink hover:text-primary-deep">
                      {project.name}
                    </span>
                  </span>
                </button>
                {project.id === activeProjectId && (
                  <span className="rounded-full bg-pass-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pass">
                    Active
                  </span>
                )}
                {project.description && (
                  <span className="w-full text-sm text-muted sm:w-auto sm:flex-1 sm:truncate">
                    {project.description}
                  </span>
                )}
                <span className="ml-auto flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(project)}
                    className={ghostButtonClasses}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleting(project)}
                    className={`${ghostButtonClasses} hover:bg-fail-tint hover:text-fail`}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating && (
        <Modal title="New project" onClose={() => setCreating(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const payload = formPayload(new FormData(event.currentTarget));
              void call(
                base,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    name: payload.name,
                    ...(payload.teamId ? { teamId: payload.teamId } : {}),
                    ...(payload.description ? { description: payload.description } : {}),
                  }),
                },
                'Project created',
              );
            }}
          >
            <ProjectFormFields teams={teams} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={ghostButtonClasses}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClasses}>
                {busy ? 'Creating…' : 'Create project'}
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
              void call(
                `${base}/${editing.id}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify(formPayload(new FormData(event.currentTarget))),
                },
                'Project updated',
              );
            }}
          >
            <ProjectFormFields
              teams={teams}
              defaults={{
                name: editing.name,
                description: editing.description,
                teamId: editing.teamId,
              }}
            />
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
            Permanently delete <span className="font-semibold">{deleting.name}</span>? All its test
            plans, suites and cases will be removed. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className={ghostButtonClasses}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void call(`${base}/${deleting.id}`, { method: 'DELETE' }, 'Project deleted')
              }
              className="rounded-[10px] bg-fail px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
