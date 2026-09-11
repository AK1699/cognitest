import Link from 'next/link';

import { healthResponseSchema } from '@cognitest/shared';
import type { HealthCheckState, HealthResponse } from '@cognitest/shared';

// The health fetch must run per-request — prerendering it at build time would
// bake in a stale (or failed) result and break `next build` without an API.
export const dynamic = 'force-dynamic';

async function getHealth(): Promise<HealthResponse | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    // a 503 (degraded) still carries a parseable body, so don't check res.ok
    const res = await fetch(`${base}/health`, { cache: 'no-store' });
    return healthResponseSchema.parse(await res.json());
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
  const health = await getHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-5xl font-bold text-primary-deep">Cognitest</h1>

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

      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold text-accent hover:text-accent-deep">
          Log in
        </Link>{' '}
        ·{' '}
        <Link href="/signup" className="font-semibold text-accent hover:text-accent-deep">
          Sign up
        </Link>
      </p>
    </main>
  );
}
