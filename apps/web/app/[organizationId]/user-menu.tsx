'use client';

import { ChevronDown, ChevronRight, LogOut, Mail, Settings, Sun, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ThemePicker } from './theme-picker';

/** Top-right account menu: avatar → profile + settings links, theme picker, logout. */
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
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
          {initial}
        </span>
        <span className="max-w-40 truncate text-sm font-semibold text-ink">{userName}</span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-card border border-line bg-white shadow-xl"
        >
          {/* identity header */}
          <div className="flex items-center gap-3 p-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-lg font-bold text-white">
              {initial}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-pass"
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-ink">{userName}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{userEmail}</span>
              </p>
            </div>
          </div>

          <div className="h-px bg-line" />

          {/* navigation */}
          <nav className="p-2">
            <MenuLink
              href={`/${organizationId}/profile`}
              icon={<User className="h-[18px] w-[18px]" aria-hidden />}
              label="My Profile"
              onNavigate={() => setOpen(false)}
            />
            <MenuLink
              href={`/${organizationId}/settings`}
              icon={<Settings className="h-[18px] w-[18px]" aria-hidden />}
              label="Settings"
              onNavigate={() => setOpen(false)}
            />

            {/* appearance */}
            <div className="px-3 pb-2 pt-3">
              <p className="mb-2 flex items-center gap-2.5 text-sm font-semibold text-ink">
                <Sun className="h-[18px] w-[18px] text-muted" aria-hidden />
                Appearance
              </p>
              <ThemePicker />
            </div>
          </nav>

          <div className="h-px bg-line" />

          {/* logout */}
          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
                  router.push('/login');
                  router.refresh();
                });
              }}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-fail transition-colors hover:bg-fail-tint"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A single navigable row in the account menu: icon, label, trailing chevron. */
function MenuLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-primary-tint hover:text-primary-deep"
    >
      <span className="text-muted transition-colors group-hover:text-primary-deep">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted transition-colors group-hover:text-primary-deep" aria-hidden />
    </Link>
  );
}
