'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cognitest-theme';

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

/** Light / Dark / System segmented control, persisted in localStorage. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setTheme(stored);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    // follow OS changes while in system mode
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  function select(next: Theme) {
    setTheme(next);
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }

  return (
    <div className="flex rounded-[10px] border border-line p-0.5">
      {(['light', 'dark', 'system'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => select(option)}
          aria-pressed={theme === option}
          className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-semibold capitalize transition-colors ${
            theme === option
              ? 'bg-primary-tint text-primary-deep'
              : 'text-muted hover:text-ink'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
