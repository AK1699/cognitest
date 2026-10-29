'use client';

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'cognitest-environment';

/** UI-level selection for now — no backend environments model yet. */
const ENVIRONMENTS = [
  { key: 'development', label: 'Development', dot: 'bg-primary' },
  { key: 'qa', label: 'QA', dot: 'bg-accent' },
  { key: 'staging', label: 'Staging', dot: 'bg-warn' },
  { key: 'production', label: 'Production', dot: 'bg-fail' },
] as const;

type EnvironmentKey = (typeof ENVIRONMENTS)[number]['key'];

export function EnvironmentSwitcher() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EnvironmentKey>('development');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (ENVIRONMENTS.some((env) => env.key === stored)) setSelected(stored as EnvironmentKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const current = ENVIRONMENTS.find((env) => env.key === selected) ?? ENVIRONMENTS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 transition-colors hover:bg-primary-tint"
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${current.dot}`} />
        <span className="text-sm font-bold text-primary-deep">{current.label}</span>
        <span aria-hidden className="pl-1 text-xs text-muted">
          ⇅
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-2 w-48 rounded-card border border-line bg-white p-2 shadow-lg"
        >
          <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-muted">
            Environment
          </p>
          {ENVIRONMENTS.map((env) => {
            const active = env.key === selected;
            return (
              <button
                key={env.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setSelected(env.key);
                  localStorage.setItem(STORAGE_KEY, env.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold ${
                  active ? 'bg-primary-tint text-primary-deep' : 'text-ink hover:bg-primary-tint/60'
                }`}
              >
                <span aria-hidden className={`h-2 w-2 rounded-full ${env.dot}`} />
                <span className="flex-1">{env.label}</span>
                {active && (
                  <span aria-hidden className="text-xs font-bold text-primary-deep">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
