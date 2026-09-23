'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ThemePicker } from './theme-picker';

/** Top-right account menu: avatar initial → profile link, theme picker, logout. */
export function UserMenu({
  organizationId,
  userName,
  userEmail,
}: {
  organizationId: string;
  userName: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const initial = (userName.trim().charAt(0) || '?').toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full border border-line bg-white py-1 pl-1 pr-3 transition-colors hover:bg-primary-tint"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-deep text-sm font-bold text-white">
          {initial}
        </span>
        <span className="max-w-40 truncate text-sm font-semibold text-ink">{userName}</span>
        <span aria-hidden className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 rounded-card border border-line bg-white p-4 shadow-lg"
        >
          <p className="truncate text-sm font-bold text-primary-deep">{userName}</p>
          <p className="mb-3 truncate text-xs text-muted">{userEmail}</p>

          <Link
            href={`/${organizationId}/profile`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mb-3 block w-full rounded-[10px] border border-line bg-white px-4 py-2 text-center text-sm font-semibold text-ink transition-colors hover:bg-primary-tint"
          >
            Profile
          </Link>

          <div className="mb-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">Theme</p>
            <ThemePicker />
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
                router.push('/login');
                router.refresh();
              });
            }}
            className="w-full rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-fail-tint hover:text-fail"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
