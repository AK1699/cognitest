'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

/**
 * Structural stand-in for a Zod schema — only safeParse is needed here, and
 * a nominal ZodType would couple this file to the exact zod instance the
 * shared package was compiled against.
 */
interface ValidationSchema {
  safeParse(value: unknown):
    | { success: true }
    | { success: false; error: { issues: { message: string }[] } };
}

/** Posts JSON to the proxied API and surfaces validation/auth errors inline. */
export function useAuthSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(
    url: string,
    body: Record<string, unknown>,
    redirectTo: string,
    schema?: ValidationSchema,
  ) {
    setError(null);
    // client-side validation first: instant, field-specific feedback
    if (schema) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Check the highlighted fields');
        return;
      }
    }
    setPending(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
        // API validation errors come as a message array ("field: reason")
        const message = Array.isArray(payload?.message)
          ? payload.message.map(String).join('. ')
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
