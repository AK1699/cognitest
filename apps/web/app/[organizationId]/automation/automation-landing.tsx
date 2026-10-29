'use client';

import { MoreHorizontal, Play, Plus, Trash2, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '../../toast';
import { Select } from '../select';
import { useActiveProject } from '../use-active-project';
import { automationApi, type Automation, type AutomationApi } from './api';
import {
  AutomationStatusBadge,
  FRAMEWORK_LABELS,
  RunStatusBadge,
  StatTile,
  primaryButton,
  timeAgo,
} from './automation-ui';
import { ConfirmModal } from '../design/confirm-modal';

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Status: All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

export function AutomationLanding({
  organizationId,
  projects,
}: {
  organizationId: string;
  projects: Project[];
}) {
  const toast = useToast();
  const [activeProject] = useActiveProject(organizationId, projects);
  const projectId = activeProject?.id ?? null;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    automationApi(organizationId, projectId)
      .list()
      .then((data) => {
        if (live) setAutomations(data.automations);
      })
      .catch((cause: unknown) => {
        if (live)
          toast.push(cause instanceof Error ? cause.message : 'Failed to load automations', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organizationId, projectId, toast]);

  const api = projectId ? automationApi(organizationId, projectId) : null;

  const totals = automations.reduce(
    (acc, a) => {
      acc.tests += a.testCount;
      acc.passed += a.passedCount;
      acc.failed += a.failedCount;
      return acc;
    },
    { tests: 0, passed: 0, failed: 0 },
  );
  const decided = totals.passed + totals.failed;
  const successRate = decided ? Math.round((totals.passed / decided) * 100) : 0;

  const visible = automations.filter((a) => {
    if (status !== 'all' && a.status !== status) return false;
    if (query.trim() && !a.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const newHref = projectId
    ? `/${organizationId}/automation/new?project=${projectId}`
    : `/${organizationId}/automation/new`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-deep">Automation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Build, manage and run automated tests — generated from your test cases or composed in
            the visual builder.
          </p>
        </div>
        {projectId && (
          <Link href={newHref} className={primaryButton}>
            <Plus aria-hidden className="h-4 w-4" />
            New Automation
          </Link>
        )}
      </div>

      {!projectId || !api ? (
        <p className="rounded-card border border-dashed border-line bg-white p-8 text-sm text-muted">
          No projects yet — create one in the Projects section to start automating tests.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile value={automations.length} label="Automations" accent="primary" />
            <StatTile value={totals.tests} label="Total Tests" accent="ink" />
            <StatTile value={totals.passed} label="Passed" accent="pass" />
            <StatTile value={totals.failed} label="Failed" accent="fail" />
            <StatTile value={`${successRate}%`} label="Success Rate" accent="accent" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search automations…"
              className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 sm:max-w-xs"
            />
            <div className="w-40">
              <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </div>
          </div>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Automations{' '}
            {activeProject && <span className="text-muted/70">· {activeProject.name}</span>}
          </h2>

          {loading ? (
            <p className="rounded-card border border-line bg-white p-10 text-center text-sm text-muted">
              Loading…
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
              {automations.length === 0
                ? 'No automations yet — create your first one.'
                : 'No automations match these filters.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  api={api}
                  automation={automation}
                  organizationId={organizationId}
                  projectId={projectId}
                  onDeleted={(id) => setAutomations((prev) => prev.filter((a) => a.id !== id))}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function AutomationCard({
  api,
  automation,
  organizationId,
  projectId,
  onDeleted,
}: {
  api: AutomationApi;
  automation: Automation;
  organizationId: string;
  projectId: string;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  async function remove() {
    setConfirmDelete(false);
    try {
      await api.remove(automation.id);
      toast.push('Automation deleted', 'success');
      onDeleted(automation.id);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to delete', 'error');
    }
  }

  const href = `/${organizationId}/automation/${automation.id}?project=${projectId}`;

  return (
    <li className="relative flex items-center gap-4 rounded-card border border-line bg-white p-5 transition-colors hover:border-primary/50 hover:bg-primary-tint/30">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-warn-tint text-warn">
          <Workflow aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{automation.name}</h3>
            <span className="rounded-full border border-line bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              {FRAMEWORK_LABELS[automation.framework]}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {automation.testCount} tests
            <span className="mx-1.5 text-pass">· {automation.passedCount} passed</span>
            {automation.failedCount > 0 && (
              <span className="mx-1.5 text-fail">· {automation.failedCount} failed</span>
            )}
            <span className="mx-1.5 text-line">·</span>
            Last run {timeAgo(automation.lastRunAt)}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <AutomationStatusBadge status={automation.status} />
        {automation.lastRunStatus && <RunStatusBadge status={automation.lastRunStatus} />}
      </div>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Automation actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line bg-white text-muted transition-colors hover:bg-primary-tint hover:text-primary-deep"
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-44 rounded-card border border-line bg-white p-1.5 shadow-lg"
          >
            <Link
              href={`${href}&tab=runs`}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-primary-tint/60"
            >
              <Play aria-hidden className="h-4 w-4 text-muted" />
              Open &amp; run
            </Link>
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
              className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-fail transition-colors hover:bg-fail-tint/50"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete automation
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete automation"
          message={`Permanently delete "${automation.name}"? This also removes its tests and run history. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </li>
  );
}
