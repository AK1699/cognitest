/* Shared presentational primitives for the Design module, on house tokens. */
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
  DesignSource,
  DesignStatus,
  RequirementStatus,
  TestCasePriority,
} from '@cognitest/shared';

/* ------------------------------------------------------------- class recipes */

export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60';
export const ghostButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-tint';
export const inputClasses =
  'min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

/* ------------------------------------------------------------------- badges */

const DESIGN_STATUS: Record<DesignStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-primary-tint text-primary-deep' },
  in_review: { label: 'In Review', className: 'bg-accent-tint text-accent-deep' },
  approved: { label: 'Approved', className: 'bg-pass-tint text-pass' },
  archived: { label: 'Archived', className: 'bg-fail-tint text-fail' },
};

export function StatusBadge({ status }: { status: DesignStatus }) {
  const { label, className } = DESIGN_STATUS[status];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

const PRIORITY: Record<TestCasePriority, string> = {
  critical: 'bg-fail-tint text-fail',
  high: 'bg-fail-tint text-fail',
  medium: 'bg-warn-tint text-warn',
  low: 'bg-primary-tint text-primary-deep',
};

export function PriorityBadge({ priority }: { priority: TestCasePriority }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${PRIORITY[priority]}`}
    >
      {priority}
    </span>
  );
}

const REQ_STATUS: Record<RequirementStatus, string> = {
  draft: 'bg-primary-tint text-primary-deep',
  active: 'bg-pass-tint text-pass',
  archived: 'bg-fail-tint text-fail',
};

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${REQ_STATUS[status]}`}
    >
      {status}
    </span>
  );
}

export function SourceChip({ source }: { source: DesignSource }) {
  return (
    <span className="rounded-full border border-line bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
      {source}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-deep">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ stepper */

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? 'bg-pass text-white'
                  : active
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white text-muted'
              }`}
            >
              {done ? <Check aria-hidden className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={`text-sm font-semibold ${active || done ? 'text-ink' : 'text-muted'}`}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden className="mx-1 h-px w-6 bg-line sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------- progress ring */

/** A donut progress ring rendered with SVG; colour defaults to the primary. */
export function ProgressRing({
  value,
  size = 96,
  stroke = 10,
  colorClass = 'text-primary',
}: {
  value: number;
  size?: number;
  stroke?: number;
  colorClass?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="text-line"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={colorClass}
          stroke="currentColor"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-ink">
        {value}%
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- section */

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

/* ---------------------------------------------------------------- coverage bar */

export function CoverageBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-ink">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-sm font-semibold text-ink">{percent}%</span>
    </div>
  );
}
