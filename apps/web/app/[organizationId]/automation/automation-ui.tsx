/* Shared presentational primitives for the Automation module, on house tokens. */
import { CheckCircle2, Clock, Loader2, MinusCircle, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
  AutomationFramework,
  AutomationMethod,
  AutomationRunStatus,
  AutomationStatus,
  AutomationTestStatus,
} from '@cognitest/shared';

/* ------------------------------------------------------------- class recipes */

export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60';
export const ghostButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-tint disabled:opacity-60';
export const inputClasses =
  'min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

/* ------------------------------------------------------------------- labels */

export const FRAMEWORK_LABELS: Record<AutomationFramework, string> = {
  playwright: 'Playwright',
  cypress: 'Cypress',
  selenium: 'Selenium',
  puppeteer: 'Puppeteer',
};

export const METHOD_LABELS: Record<AutomationMethod, string> = {
  from_test_cases: 'From Test Cases',
  visual: 'Built Visually',
  record: 'Recorded',
  import: 'Imported',
};

/* ------------------------------------------------------------------- badges */

const AUTOMATION_STATUS: Record<AutomationStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-primary-tint text-primary-deep' },
  active: { label: 'Active', className: 'bg-pass-tint text-pass' },
  disabled: { label: 'Disabled', className: 'bg-warn-tint text-warn' },
  archived: { label: 'Archived', className: 'bg-fail-tint text-fail' },
};

export function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  const { label, className } = AUTOMATION_STATUS[status];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

const RUN_STATUS: Record<AutomationRunStatus, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-primary-tint text-primary-deep' },
  running: { label: 'Running', className: 'bg-accent-tint text-accent-deep' },
  passed: { label: 'Passed', className: 'bg-pass-tint text-pass' },
  failed: { label: 'Failed', className: 'bg-fail-tint text-fail' },
  cancelled: { label: 'Cancelled', className: 'bg-warn-tint text-warn' },
};

export function RunStatusBadge({ status }: { status: AutomationRunStatus }) {
  const { label, className } = RUN_STATUS[status];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

const TEST_STATUS: Record<
  AutomationTestStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  not_run: { label: 'Not run', className: 'text-muted', icon: MinusCircle },
  passed: { label: 'Passed', className: 'text-pass', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'text-fail', icon: XCircle },
  skipped: { label: 'Skipped', className: 'text-warn', icon: Clock },
};

/** Inline status with an icon, used in test/result rows. */
export function TestStatusTag({ status }: { status: AutomationTestStatus }) {
  const { label, className, icon: Icon } = TEST_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${className}`}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------- stat tile */

const TILE_ACCENTS = {
  ink: 'text-ink',
  primary: 'text-primary-deep',
  pass: 'text-pass',
  fail: 'text-fail',
  accent: 'text-accent-deep',
} as const;

/** The dashboard/overview summary tile (big number + label). */
export function StatTile({
  value,
  label,
  accent = 'ink',
}: {
  value: ReactNode;
  label: string;
  accent?: keyof typeof TILE_ACCENTS;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <p className={`text-3xl font-bold ${TILE_ACCENTS[accent]}`}>{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-line bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {typeof title === 'string' ? (
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------- helpers */

/** Milliseconds → a compact human duration (e.g. 1m 24s, 18s). */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Relative "time ago" for run timestamps, kept dependency-free. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff)) return 'never';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export { Loader2 };
