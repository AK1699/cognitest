'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Modal } from '../modal';
import { useToast } from '../../toast';
import { useActiveProject } from '../use-active-project';

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

interface TestPlan {
  id: string;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  version: number;
}

interface TestSuite {
  id: string;
  title: string;
}

interface TestCase {
  id: string;
  title: string;
  priority: string;
  steps: { action: string; expected?: string }[];
}

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

const STATUS_STYLES: Record<TestPlan['status'], string> = {
  draft: 'bg-primary-tint text-primary-deep',
  in_review: 'bg-accent-tint text-accent-deep',
  approved: 'bg-pass-tint text-pass',
  archived: 'bg-fail-tint text-fail',
};

const inputClasses =
  'min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
const buttonClasses =
  'rounded-[10px] bg-accent px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60';
const ghostButtonClasses =
  'rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint';

export function DesignBoard({
  organizationId,
  initialProjects,
}: {
  organizationId: string;
  initialProjects: Project[];
}) {
  const toast = useToast();
  // the Design module works on the app-wide active project (header breadcrumb)
  const [activeProject] = useActiveProject(organizationId, initialProjects);
  const selected = activeProject?.id ?? null;
  // children report failures here; a null clears nothing — toasts self-dismiss
  const onError = useCallback(
    (message: string | null) => {
      if (message) toast.push(message, 'error');
    },
    [toast],
  );

  const base = `/api/organizations/${organizationId}`;

  return (
    <div className="flex flex-col gap-4">
      {selected ? (
        <ProjectPlans key={selected} base={base} projectId={selected} onError={onError} />
      ) : (
        <p className="rounded-card border border-dashed border-line bg-white p-8 text-sm text-muted">
          No projects yet — create one in the Projects section to start designing tests.
        </p>
      )}
    </div>
  );
}

function ProjectPlans({
  base,
  projectId,
  onError,
}: {
  base: string;
  projectId: string;
  onError: (message: string | null) => void;
}) {
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const projectBase = `${base}/projects/${projectId}`;

  const reload = useCallback(async () => {
    const data = await json<{ testPlans: TestPlan[] }>(`${projectBase}/test-plans`);
    setPlans(data.testPlans);
  }, [projectBase]);

  useEffect(() => {
    reload().catch((cause: unknown) =>
      onError(cause instanceof Error ? cause.message : 'Failed to load plans'),
    );
  }, [reload, onError]);

  async function guard(fn: () => Promise<void>) {
    onError(null);
    try {
      await fn();
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Something went wrong');
    }
  }

  const act = (planId: string, path: string, body?: object) => () =>
    void guard(async () => {
      await json(`${projectBase}/test-plans/${planId}${path}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
    });

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Test plans</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`${buttonClasses} flex items-center gap-1.5`}
        >
          <Plus aria-hidden className="h-4 w-4" />
          New test plan
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-muted">No test plans in this project yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {plans.map((plan) => (
            <li key={plan.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
                  className="text-left text-sm font-semibold text-ink hover:text-primary-deep"
                >
                  {expanded === plan.id ? '▾' : '▸'} {plan.title}
                </button>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[plan.status]}`}
                >
                  {plan.status.replace('_', ' ')} · v{plan.version}
                </span>
                <span className="ml-auto flex gap-2">
                  {plan.status === 'draft' && (
                    <button
                      type="button"
                      onClick={act(plan.id, '/submit')}
                      className={ghostButtonClasses}
                    >
                      Submit for review
                    </button>
                  )}
                  {plan.status === 'in_review' && (
                    <>
                      <button
                        type="button"
                        onClick={act(plan.id, '/decision', { decision: 'approved' })}
                        className={ghostButtonClasses}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={act(plan.id, '/decision', { decision: 'rejected' })}
                        className={ghostButtonClasses}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {plan.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() =>
                        void guard(async () => {
                          await json(`${projectBase}/test-plans/${plan.id}`, { method: 'DELETE' });
                        })
                      }
                      className={ghostButtonClasses}
                    >
                      Archive
                    </button>
                  )}
                </span>
              </div>
              {expanded === plan.id && (
                <PlanSuites projectBase={projectBase} planId={plan.id} onError={onError} />
              )}
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <Modal title="New test plan" onClose={() => setCreating(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const title = String(new FormData(event.currentTarget).get('title') ?? '').trim();
              if (!title) return;
              setCreating(false);
              void guard(async () => {
                await json(`${projectBase}/test-plans`, {
                  method: 'POST',
                  body: JSON.stringify({ title }),
                });
              });
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Title
              <input
                name="title"
                required
                placeholder="e.g. Release 1.0 regression"
                className={inputClasses}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={ghostButtonClasses}
              >
                Cancel
              </button>
              <button type="submit" className={buttonClasses}>
                Create test plan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function PlanSuites({
  projectBase,
  planId,
  onError,
}: {
  projectBase: string;
  planId: string;
  onError: (message: string | null) => void;
}) {
  const [suites, setSuites] = useState<TestSuite[]>([]);

  const reload = useCallback(async () => {
    const data = await json<{ testSuites: TestSuite[] }>(
      `${projectBase}/test-plans/${planId}/suites`,
    );
    setSuites(data.testSuites);
  }, [projectBase, planId]);

  useEffect(() => {
    reload().catch((cause: unknown) =>
      onError(cause instanceof Error ? cause.message : 'Failed to load suites'),
    );
  }, [reload, onError]);

  return (
    <div className="mt-3 ml-5 rounded-[10px] border border-line bg-cream/60 p-4">
      <form
        className="mb-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const title = String(new FormData(event.currentTarget).get('title') ?? '').trim();
          event.currentTarget.reset();
          void (async () => {
            try {
              await json(`${projectBase}/test-plans/${planId}/suites`, {
                method: 'POST',
                body: JSON.stringify({ title }),
              });
              await reload();
            } catch (cause) {
              onError(cause instanceof Error ? cause.message : 'Something went wrong');
            }
          })();
        }}
      >
        <input name="title" required placeholder="New suite title" className={inputClasses} />
        <button type="submit" className={buttonClasses}>
          + Suite
        </button>
      </form>
      {suites.length === 0 ? (
        <p className="text-sm text-muted">No suites yet.</p>
      ) : (
        suites.map((suite) => (
          <SuiteCases key={suite.id} projectBase={projectBase} suite={suite} onError={onError} />
        ))
      )}
    </div>
  );
}

function SuiteCases({
  projectBase,
  suite,
  onError,
}: {
  projectBase: string;
  suite: TestSuite;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<TestCase[]>([]);

  const reload = useCallback(async () => {
    const data = await json<{ testCases: TestCase[] }>(
      `${projectBase}/test-suites/${suite.id}/cases`,
    );
    setCases(data.testCases);
  }, [projectBase, suite.id]);

  useEffect(() => {
    if (!open) return;
    reload().catch((cause: unknown) =>
      onError(cause instanceof Error ? cause.message : 'Failed to load cases'),
    );
  }, [open, reload, onError]);

  return (
    <div className="mb-2 rounded-[10px] border border-line bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm font-semibold text-ink hover:text-primary-deep"
      >
        {open ? '▾' : '▸'} {suite.title}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const title = String(form.get('title') ?? '').trim();
              // one step per line: "action => expected"
              const steps = String(form.get('steps') ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const [action, expected] = line.split('=>').map((part) => part.trim());
                  return expected
                    ? { action: action ?? line, expected }
                    : { action: action ?? line };
                });
              event.currentTarget.reset();
              void (async () => {
                try {
                  await json(`${projectBase}/test-suites/${suite.id}/cases`, {
                    method: 'POST',
                    body: JSON.stringify({ title, steps }),
                  });
                  await reload();
                } catch (cause) {
                  onError(cause instanceof Error ? cause.message : 'Something went wrong');
                }
              })();
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input name="title" required placeholder="New case title" className={inputClasses} />
              <textarea
                name="steps"
                rows={2}
                placeholder={'Steps, one per line: action => expected'}
                className={`${inputClasses} resize-y font-mono text-xs`}
              />
            </div>
            <button type="submit" className={`${buttonClasses} self-start`}>
              + Case
            </button>
          </form>
          {cases.map((testCase) => (
            <div key={testCase.id} className="rounded-[10px] bg-primary-tint/50 px-3 py-2">
              <p className="text-sm font-semibold text-ink">
                {testCase.title}{' '}
                <span className="ml-1 text-xs font-bold uppercase text-muted">
                  {testCase.priority}
                </span>
              </p>
              {testCase.steps.length > 0 && (
                <ol className="mt-1 list-inside list-decimal text-xs text-muted">
                  {testCase.steps.map((step, index) => (
                    <li key={index}>
                      {step.action}
                      {step.expected ? ` — expect: ${step.expected}` : ''}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
