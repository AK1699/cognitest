import { cookies } from 'next/headers';
import Link from 'next/link';

import { healthResponseSchema, meResponseSchema } from '@cognitest/shared';
import type { HealthCheckState, HealthResponse, MeResponse } from '@cognitest/shared';

import { LogoutButton } from './logout-button';

// Both fetches must run per-request — prerendering would bake in stale results
// and the session is cookie-bound anyway.
export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function getHealth(): Promise<HealthResponse | null> {
  try {
    // a 503 (degraded) still carries a parseable body, so don't check res.ok
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    return healthResponseSchema.parse(await res.json());
  } catch {
    return null;
  }
}

/** Server-side session check: forwards the browser cookie to the API. */
async function getMe(): Promise<MeResponse | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return meResponseSchema.parse(await res.json());
  } catch {
    return null;
  }
}

function StatusBadge({ state }: { state: HealthCheckState }) {
  return state === 'up' ? (
    <span className="rounded-full bg-pass-tint px-2.5 py-0.5 text-xs font-bold text-pass">up</span>
  ) : (
    <span className="rounded-full bg-fail-tint px-2.5 py-0.5 text-xs font-bold text-fail">
      down
    </span>
  );
}

export default async function HomePage() {
  const [health, me] = await Promise.all([getHealth(), getMe()]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-5xl font-bold text-primary-deep">Cognitest</h1>

      {me ? (
        <section className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-line bg-white p-6">
          <div>
            <p className="text-sm font-bold text-primary-deep">{me.user.displayName}</p>
            <p className="text-sm text-muted">{me.user.email}</p>
          </div>
          {me.user.status === 'pending_verification' && (
            <p className="rounded-[10px] bg-primary-tint px-3.5 py-2.5 text-sm text-ink">
              Check your inbox to verify your email address.
            </p>
          )}
          <LogoutButton />
        </section>
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-semibold text-accent hover:text-accent-deep">
            Log in
          </Link>{' '}
          ·{' '}
          <Link href="/signup" className="font-semibold text-accent hover:text-accent-deep">
            Sign up
          </Link>
        </p>
      )}

      <section className="w-full max-w-sm rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">API health</h2>

        {health === null ? (
          <p className="text-sm text-ink">
            API unreachable — run{' '}
            <code className="rounded bg-primary-tint px-1 py-0.5 font-mono text-xs">
              docker compose up -d && pnpm dev
            </code>
          </p>
        ) : (
          <ul className="space-y-3 text-sm text-ink">
            <li className="flex items-center justify-between">
              <span>Overall</span>
              <span className="font-bold text-primary-deep">{health.status}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>PostgreSQL</span>
              <StatusBadge state={health.checks.postgres} />
            </li>
            <li className="flex items-center justify-between">
              <span>Redis</span>
              <StatusBadge state={health.checks.redis} />
            </li>
          </ul>
        )}
      </section>
    </main>
  );
}
