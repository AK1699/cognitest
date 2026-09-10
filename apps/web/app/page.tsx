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

function StatusDot({ state }: { state: HealthCheckState }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        state === 'up' ? 'bg-emerald-400' : 'bg-red-400'
      }`}
    />
  );
}

export default async function HomePage() {
  const health = await getHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-5xl font-bold tracking-tight">Cognitest</h1>

      <section className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          API health
        </h2>

        {health === null ? (
          <p className="text-sm text-slate-300">
            API unreachable — run{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">
              docker compose up -d && pnpm dev
            </code>
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span>Overall</span>
              <span className="font-medium">{health.status}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>PostgreSQL</span>
              <StatusDot state={health.checks.postgres} />
            </li>
            <li className="flex items-center justify-between">
              <span>Redis</span>
              <StatusDot state={health.checks.redis} />
            </li>
          </ul>
        )}
      </section>
    </main>
  );
}
