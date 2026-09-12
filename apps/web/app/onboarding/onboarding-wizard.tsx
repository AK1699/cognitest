'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormError } from '../(auth)/auth-form';
import { Field, PrimaryButton } from '../(auth)/components';

type Step = 'organization' | 'team' | 'invite';

interface RoleOption {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}

interface InviteRow {
  email: string;
  roleId: string;
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'organization', label: 'Organization' },
  { key: 'team', label: 'Team' },
  { key: 'invite', label: 'Invite' },
];

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  return base.length > 0 ? base.slice(0, 48) : 'team';
}

async function postJson(url: string, method: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function errorMessage(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

export function OnboardingWizard({
  initialOrganization,
  initialStep,
}: {
  initialOrganization: { id: string; name: string } | null;
  initialStep: Step;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [organization, setOrganization] = useState(initialOrganization);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([{ email: '', roleId: '' }]);

  // step 3 needs the role catalogue for its dropdowns
  useEffect(() => {
    if (step !== 'invite' || !organization || roles.length > 0) return;
    void fetch(`/api/organizations/${organization.id}/roles`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { roles: RoleOption[] } | null) => {
        if (!data) return;
        const system = data.roles.filter((r) => r.isSystem && r.key !== 'admin');
        setRoles(system);
        const tester = system.find((r) => r.key === 'tester') ?? system[0];
        if (tester) {
          setInvites((rows) =>
            rows.map((row) => (row.roleId ? row : { ...row, roleId: tester.id })),
          );
        }
      });
  }, [step, organization, roles.length]);

  async function run(fn: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong — try again');
    } finally {
      setPending(false);
    }
  }

  async function createOrganization(name: string) {
    await run(async () => {
      if (!name.trim()) throw new Error('Organization name is required');
      const res = await postJson('/api/organizations', 'POST', {
        name: name.trim(),
        defaultTeam: false,
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const data = (await res.json()) as { organization: { id: string; name: string } };
      setOrganization(data.organization);
      setStep('team');
    });
  }

  async function createTeam(name: string) {
    await run(async () => {
      if (!organization) throw new Error('Create the organization first');
      if (!name.trim()) throw new Error('Team name is required');
      const res = await postJson(`/api/organizations/${organization.id}/teams`, 'POST', {
        name: name.trim(),
        slug: slugify(name),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      await postJson(`/api/organizations/${organization.id}`, 'PATCH', {
        onboardingStep: 'invite',
      });
      setStep('invite');
    });
  }

  async function finish(sendInvites: boolean) {
    await run(async () => {
      if (!organization) throw new Error('Create the organization first');
      if (sendInvites) {
        const rows = invites.filter((row) => row.email.trim().length > 0);
        for (const row of rows) {
          const res = await postJson(`/api/organizations/${organization.id}/invitations`, 'POST', {
            email: row.email.trim(),
            roleId: row.roleId,
          });
          if (!res.ok) throw new Error(`${row.email}: ${await errorMessage(res)}`);
        }
      }
      const res = await postJson(`/api/organizations/${organization.id}`, 'PATCH', {
        onboardingStatus: 'completed',
        onboardingStep: null,
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      router.push(`/${organization.id}/dashboard`);
      router.refresh();
    });
  }

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <section className="w-full max-w-md rounded-card border border-line bg-white p-8">
      {/* step indicator */}
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((s, index) => (
          <li key={s.key} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${index <= currentIndex ? 'bg-accent' : 'bg-line'}`}
            />
            <span
              className={`text-xs font-semibold ${
                index === currentIndex ? 'text-primary-deep' : 'text-muted'
              }`}
            >
              {index + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      {step === 'organization' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createOrganization(new FormData(event.currentTarget).get('name') as string);
          }}
        >
          <header>
            <h1 className="text-xl font-bold text-primary-deep">Name your organization</h1>
            <p className="mt-1 text-sm text-muted">
              This is your company workspace — you&apos;ll be its admin.
            </p>
          </header>
          <FormError error={error} />
          <Field id="name" label="Organization name" type="text" placeholder="Acme QA" autoComplete="organization" />
          <PrimaryButton>{pending ? 'Creating…' : 'Continue'}</PrimaryButton>
        </form>
      )}

      {step === 'team' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createTeam(new FormData(event.currentTarget).get('name') as string);
          }}
        >
          <header>
            <h1 className="text-xl font-bold text-primary-deep">Create your first team</h1>
            <p className="mt-1 text-sm text-muted">
              Teams group members inside {organization?.name ?? 'your organization'}.
            </p>
          </header>
          <FormError error={error} />
          <Field id="name" label="Team name" type="text" placeholder="QA Core" autoComplete="off" />
          <PrimaryButton>{pending ? 'Creating…' : 'Continue'}</PrimaryButton>
        </form>
      )}

      {step === 'invite' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void finish(true);
          }}
        >
          <header>
            <h1 className="text-xl font-bold text-primary-deep">Invite your teammates</h1>
            <p className="mt-1 text-sm text-muted">
              They&apos;ll get an email invitation — you can also do this later.
            </p>
          </header>
          <FormError error={error} />
          {invites.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="email"
                value={row.email}
                placeholder="teammate@company.com"
                onChange={(event) =>
                  setInvites((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, email: event.target.value } : r)),
                  )
                }
                className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <select
                value={row.roleId}
                onChange={(event) =>
                  setInvites((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, roleId: event.target.value } : r)),
                  )
                }
                className="rounded-[10px] border border-line bg-white px-2.5 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setInvites((rows) => [...rows, { email: '', roleId: roles[0]?.id ?? '' }])
            }
            className="self-start text-sm font-semibold text-accent hover:text-accent-deep"
          >
            + Add another
          </button>
          <PrimaryButton>{pending ? 'Finishing…' : 'Send invitations & finish'}</PrimaryButton>
          <button
            type="button"
            disabled={pending}
            onClick={() => void finish(false)}
            className="text-sm font-semibold text-muted hover:text-ink"
          >
            Skip for now
          </button>
        </form>
      )}
    </section>
  );
}
