'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogoutButton } from '../logout-button';

interface NavItem {
  segment: string;
  label: string;
  icon: string; // emoji keeps the shell dependency-free; iconography can come later
  enabled: boolean;
}

const NAV: NavItem[] = [
  { segment: 'dashboard', label: 'Dashboard', icon: '◫', enabled: true },
  { segment: 'design', label: 'Design', icon: '✎', enabled: true },
  { segment: 'automation', label: 'Automation', icon: '⚙', enabled: false },
  { segment: 'api-testing', label: 'API Testing', icon: '⇄', enabled: false },
  { segment: 'performance-testing', label: 'Performance', icon: '↯', enabled: false },
  { segment: 'security-testing', label: 'Security', icon: '⛨', enabled: false },
  { segment: 'members', label: 'Members', icon: '☺', enabled: true },
  { segment: 'settings', label: 'Settings', icon: '⚒', enabled: true },
];

export function Sidebar({
  organizationId,
  organizationName,
  userName,
  userEmail,
}: {
  organizationId: string;
  organizationName: string;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <Link href={`/${organizationId}/dashboard`} className="font-display text-xl font-bold tracking-tight text-primary-deep">
          Cognitest
        </Link>
        <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">
          {organizationName}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const href = `/${organizationId}/${item.segment}`;
            const active = pathname.startsWith(href);
            if (!item.enabled) {
              return (
                <li key={item.segment}>
                  <span className="flex cursor-not-allowed items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-muted/60">
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                    <span className="ml-auto rounded-full bg-primary-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-deep">
                      Soon
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.segment}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary-tint text-primary-deep'
                      : 'text-ink hover:bg-primary-tint/60'
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-4">
        <p className="truncate text-sm font-bold text-primary-deep">{userName}</p>
        <p className="mb-3 truncate text-xs text-muted">{userEmail}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
