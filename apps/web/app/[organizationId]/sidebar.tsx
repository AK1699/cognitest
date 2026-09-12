'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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

interface OrganizationOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  key: string;
  name: string;
}

function OrgSwitcher({
  organizationId,
  organizationName,
  organizations,
}: {
  organizationId: string;
  organizationName: string;
  organizations: OrganizationOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const others = organizations.filter((org) => org.id !== organizationId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-[10px] border border-line bg-white px-3 py-2 text-left transition-colors hover:bg-primary-tint"
      >
        <span className="truncate text-sm font-bold text-primary-deep">{organizationName}</span>
        <span aria-hidden className="ml-2 text-xs text-muted">
          ⇅
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-20 mt-2 rounded-card border border-line bg-white p-2 shadow-lg"
        >
          {others.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted">No other workspaces</p>
          ) : (
            others.map((org) => (
              <button
                key={org.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push(`/${org.id}/dashboard`);
                }}
                className="block w-full truncate rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink hover:bg-primary-tint"
              >
                {org.name}
              </button>
            ))
          )}
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-[8px] border-t border-line px-2 pt-2 pb-1.5 text-sm font-semibold text-accent hover:text-accent-deep"
          >
            + New workspace
          </Link>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  organizationId,
  organizationName,
  organizations,
  projects,
}: {
  organizationId: string;
  organizationName: string;
  organizations: OrganizationOption[];
  projects: ProjectOption[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white">
      <div className="border-b border-line px-4 py-4">
        <Link
          href={`/${organizationId}/dashboard`}
          className="mb-3 block px-1 font-display text-xl font-bold tracking-tight text-primary-deep"
        >
          Cognitest
        </Link>
        <OrgSwitcher
          organizationId={organizationId}
          organizationName={organizationName}
          organizations={organizations}
        />
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

        <div className="mt-6">
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-muted">
            Projects
          </p>
          {projects.length === 0 ? (
            <Link
              href={`/${organizationId}/design`}
              className="block px-3 text-sm text-muted hover:text-primary-deep"
            >
              Create one in Design →
            </Link>
          ) : (
            <ul className="space-y-0.5">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/${organizationId}/design?project=${project.id}`}
                    className="flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm text-ink transition-colors hover:bg-primary-tint/60"
                  >
                    <span className="rounded bg-primary-tint px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-deep">
                      {project.key}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </aside>
  );
}
