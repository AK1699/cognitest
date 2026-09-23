'use client';

import {
  ArrowLeftRight,
  Building2,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  PenLine,
  Settings,
  Shield,
  Users,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';

import { useActiveProject } from './use-active-project';

interface NavItem {
  segment: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** icon colour when the item is enabled; disabled items stay muted */
  iconColor: string;
  enabled: boolean;
}

const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      {
        segment: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        iconColor: 'text-primary',
        enabled: true,
      },
    ],
  },
  {
    title: 'Testing Modules',
    items: [
      { segment: 'design', label: 'Design', icon: PenLine, iconColor: 'text-accent', enabled: true },
      {
        segment: 'automation',
        label: 'Automation',
        icon: Workflow,
        iconColor: 'text-warn',
        enabled: false,
      },
      {
        segment: 'api-testing',
        label: 'API Testing',
        icon: ArrowLeftRight,
        iconColor: 'text-pass',
        enabled: false,
      },
      {
        segment: 'performance-testing',
        label: 'Performance',
        icon: Zap,
        iconColor: 'text-warn',
        enabled: false,
      },
      {
        segment: 'security-testing',
        label: 'Security',
        icon: Shield,
        iconColor: 'text-fail',
        enabled: false,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        segment: 'projects',
        label: 'Projects',
        icon: FolderKanban,
        iconColor: 'text-accent',
        enabled: true,
      },
      {
        segment: 'organization',
        label: 'Organisation',
        icon: Building2,
        iconColor: 'text-primary',
        enabled: true,
      },
      {
        segment: 'teams',
        label: 'Teams',
        icon: UsersRound,
        iconColor: 'text-primary',
        enabled: true,
      },
      { segment: 'members', label: 'Members', icon: Users, iconColor: 'text-pass', enabled: true },
      {
        segment: 'roles',
        label: 'Roles & Permissions',
        icon: KeyRound,
        iconColor: 'text-warn',
        enabled: true,
      },
      {
        segment: 'settings',
        label: 'Settings',
        icon: Settings,
        iconColor: 'text-muted',
        enabled: true,
      },
    ],
  },
];

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export interface ProjectOption {
  id: string;
  key: string;
  name: string;
  status: string;
  teamId: string | null;
}

export function OrgSwitcher({
  organizationId,
  organizationName,
  organizations,
  teams = [],
  projects = [],
  context,
}: {
  organizationId: string;
  organizationName: string;
  organizations: OrganizationOption[];
  teams?: TeamOption[];
  projects?: ProjectOption[];
  /** Extra breadcrumb segments (team/project) rendered inside the button. */
  context?: ReactNode;
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

  const [activeProject, setActiveProject] = useActiveProject(organizationId, projects);
  const activeProjectId = activeProject?.id ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full min-w-56 items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-left transition-colors hover:bg-primary-tint"
      >
        <span className="truncate text-sm font-bold text-primary-deep">{organizationName}</span>
        {context}
        <span aria-hidden className="ml-auto pl-2 text-xs text-muted">
          ⇅
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-20 mt-2 rounded-card border border-line bg-white p-2 shadow-lg"
        >
          {/* current workspace, marked active */}
          <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-muted">
            Organisation
          </p>
          <div className="flex items-center justify-between rounded-[8px] bg-primary-tint px-2 py-1.5">
            <span className="truncate text-sm font-bold text-primary-deep">{organizationName}</span>
            <span aria-hidden className="text-xs font-bold text-primary-deep">
              ✓
            </span>
          </div>

          {teams.length > 0 && (
            <div className="mt-2">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-muted">Teams</p>
              {teams.map((team) => {
                // active team = the active project's owning team
                const active = team.id === activeProject?.teamId;
                return (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between rounded-[8px] px-2 py-1.5 pl-4 text-sm font-semibold ${
                      active ? 'bg-primary-tint text-primary-deep' : 'text-ink'
                    }`}
                  >
                    <span className="truncate">{team.name}</span>
                    {active && (
                      <span aria-hidden className="text-xs font-bold text-primary-deep">
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-muted">
              Projects
            </p>
            {projects.length === 0 ? (
              <p className="px-2 py-1.5 pl-4 text-sm text-muted">No projects yet</p>
            ) : (
              projects.map((project) => {
                const active = project.id === activeProjectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    role="menuitem"
                    title="Set as active project"
                    onClick={() => {
                      setActiveProject(project.id);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-[8px] px-2 py-1.5 pl-4 text-left text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-primary-tint text-primary-deep'
                        : 'text-ink hover:bg-primary-tint/60'
                    }`}
                  >
                    <span className="truncate">{project.name}</span>
                    {active && (
                      <span aria-hidden className="text-xs font-bold text-primary-deep">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 border-t border-line pt-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-muted">
              Other workspaces
            </p>
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
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white">
      <div className="border-b border-line px-4 py-4">
        <Link
          href={`/${organizationId}/dashboard`}
          className="block px-1 font-display text-xl font-bold tracking-tight text-primary-deep"
        >
          Cognitest
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? 'top'}>
            {group.title && (
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wide text-muted">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const href = `/${organizationId}/${item.segment}`;
                const active = pathname.startsWith(href);
                if (!item.enabled) {
                  return (
                    <li key={item.segment}>
                      <span className="flex cursor-not-allowed items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-muted/60">
                        <item.icon aria-hidden className="h-4 w-4 shrink-0" />
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
                      <item.icon aria-hidden className={`h-4 w-4 shrink-0 ${item.iconColor}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
