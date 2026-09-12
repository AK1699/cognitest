'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

/** Posts JSON to the proxied API and surfaces validation/auth errors inline. */
export function useAuthSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(url: string, body: Record<string, unknown>, redirectTo: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
        const message = Array.isArray(payload?.message)
          ? String(payload.message[0])
          : typeof payload?.message === 'string'
            ? payload.message
            : 'Something went wrong — try again';
        setError(message);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Network error — is the API running?');
    } finally {
      setPending(false);
    }
  }

  return { submit, error, pending };
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-fail-tint px-3.5 py-2.5 text-sm text-fail">
      {error}
    </p>
  );
}

export function AuthForm({
  onSubmit,
  children,
}: {
  onSubmit: (fields: Record<string, string>) => void;
  children: ReactNode;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields: Record<string, string> = {};
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string') fields[key] = value;
    }
    onSubmit(fields);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
