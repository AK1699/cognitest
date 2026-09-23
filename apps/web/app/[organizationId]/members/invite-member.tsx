'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Modal } from '../modal';
import { Select } from '../select';
import { useToast } from '../../toast';

interface RoleOption {
  id: string;
  key: string;
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

export function InviteMember({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: RoleOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const defaultRoleId = roles.find((role) => role.key === 'tester')?.id ?? roles[0]?.id;

  async function invite(email: string, roleId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invitations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, roleId }),
      });
      if (!res.ok) throw new Error(await readError(res));
      toast.push(`Invitation sent to ${email}`, 'success');
      setOpen(false);
      router.refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${primaryButtonClasses} flex items-center gap-1.5`}
      >
        <Plus aria-hidden className="h-4 w-4" />
        Invite member
      </button>

      {open && (
        <Modal title="Invite member" onClose={() => setOpen(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const email = String(form.get('email') ?? '').trim();
              const roleId = String(form.get('roleId') ?? '');
              if (email && roleId) void invite(email, roleId);
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="teammate@company.com"
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Role
              <Select
                name="roleId"
                defaultValue={defaultRoleId}
                options={roles.map((role) => ({ value: role.id, label: role.name }))}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={ghostButtonClasses}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClasses}>
                {busy ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
