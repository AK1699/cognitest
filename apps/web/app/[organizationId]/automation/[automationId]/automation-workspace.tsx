'use client';

import {
  ChevronRight,
  Code2,
  Download,
  FileCode2,
  FolderClosed,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AutomationFramework } from '@cognitest/shared';

import { Modal } from '../../modal';
import { Select } from '../../select';
import { useToast } from '../../../toast';
import { useActiveProject } from '../../use-active-project';
import { ConfirmModal } from '../../design/confirm-modal';
import {
  automationApi,
  type Automation,
  type AutomationApi,
  type AutomationEnvironment,
  type AutomationTest,
} from '../api';
import {
  AutomationStatusBadge,
  FRAMEWORK_LABELS,
  RunStatusBadge,
  SectionCard,
  StatTile,
  ghostButton,
  inputClasses,
  primaryButton,
  timeAgo,
} from '../automation-ui';
import { Toggle } from '../toggle';
import { BuilderPanel, CodePanel } from './builder-panel';
import { RunsPanel } from './runs-panel';
import { TestsPanel } from './tests-panel';

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

type TabKey = 'overview' | 'tests' | 'builder' | 'code' | 'runs' | 'settings';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tests', label: 'Tests' },
  { key: 'builder', label: 'Visual Builder' },
  { key: 'code', label: 'Code' },
  { key: 'runs', label: 'Runs' },
  { key: 'settings', label: 'Settings' },
];

export function AutomationWorkspace({
  organizationId,
  automationId,
  projects,
}: {
  organizationId: string;
  automationId: string;
  projects: Project[];
}) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeProject] = useActiveProject(organizationId, projects);
  const projectId = activeProject?.id ?? null;

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [tests, setTests] = useState<AutomationTest[]>([]);
  const [loading, setLoading] = useState(true);
  const initialTab = (searchParams.get('tab') as TabKey) ?? 'overview';
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'overview',
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const api = projectId ? automationApi(organizationId, projectId) : null;

  const reload = useCallback(async () => {
    if (!api) return;
    const [{ automation: fresh }, { tests: freshTests }] = await Promise.all([
      api.get(automationId),
      api.listTests(automationId),
    ]);
    setAutomation(fresh);
    setTests(freshTests);
  }, [api, automationId]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const client = automationApi(organizationId, projectId);
    Promise.all([client.get(automationId), client.listTests(automationId)])
      .then(([{ automation: fresh }, { tests: freshTests }]) => {
        if (!live) return;
        setAutomation(fresh);
        setTests(freshTests);
      })
      .catch((cause: unknown) => {
        if (live)
          toast.push(cause instanceof Error ? cause.message : 'Failed to load automation', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organizationId, projectId, automationId, toast]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  async function deleteAutomation() {
    if (!api || !automation) return;
    try {
      await api.remove(automation.id);
      toast.push('Automation deleted', 'success');
      router.push(`/${organizationId}/automation`);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to delete', 'error');
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!api || !automation) {
    return (
      <div>
        <Link
          href={`/${organizationId}/automation`}
          className="text-sm text-accent hover:underline"
        >
          ← Back to automations
        </Link>
        <p className="mt-4 rounded-card border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          This automation could not be loaded. It may have been deleted, or belong to another
          project.
        </p>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <Link href={`/${organizationId}/automation`} className="hover:text-primary-deep">
          Automation
        </Link>
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        <span className="font-semibold text-ink">{automation.name}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary-deep">{automation.name}</h1>
            <AutomationStatusBadge status={automation.status} />
            {automation.lastRunStatus && <RunStatusBadge status={automation.lastRunStatus} />}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {activeProject && <>Project: {activeProject.name}</>}
            <span className="text-line">•</span>
            {FRAMEWORK_LABELS[automation.framework]}
            <span className="text-line">•</span>
            Updated {timeAgo(automation.updatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTab('runs')} className={primaryButton}>
            <Play aria-hidden className="h-4 w-4" />
            Run
          </button>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Automation actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={ghostButton}
            >
              <MoreHorizontal aria-hidden className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-44 rounded-card border border-line bg-white p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-primary-tint/60"
                >
                  <Pencil aria-hidden className="h-4 w-4 text-muted" />
                  Edit details
                </button>
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
        </div>
      </div>

      {editing && (
        <EditAutomationModal
          api={api}
          automation={automation}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete automation"
          message={`Permanently delete "${automation.name}"? This also removes its tests and run history. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmDelete(false);
            void deleteAutomation();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <div className="mb-6 border-b border-line">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-accent text-accent-deep'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          automation={automation}
          tests={tests}
          onNavigate={(key) => setTab(key)}
        />
      )}
      {tab === 'tests' && (
        <TestsPanel api={api} automationId={automationId} automation={automation} onChange={reload} />
      )}
      {tab === 'builder' && (
        <BuilderPanel api={api} automation={automation} onChange={reload} />
      )}
      {tab === 'code' && <CodePanel automation={automation} tests={tests} />}
      {tab === 'runs' && (
        <RunsPanel api={api} automationId={automationId} automation={automation} onChange={reload} />
      )}
      {tab === 'settings' && (
        <SettingsTab api={api} automation={automation} onSaved={reload} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- overview */

const SCAFFOLD_FOLDERS = [
  { name: 'tests', hint: 'Spec files' },
  { name: 'pages', hint: 'Page objects' },
  { name: 'fixtures', hint: 'Test fixtures' },
  { name: 'utils', hint: 'Helpers' },
  { name: 'config', hint: 'Runner config' },
];

function OverviewTab({
  automation,
  tests,
  onNavigate,
}: {
  automation: Automation;
  tests: AutomationTest[];
  onNavigate: (tab: TabKey) => void;
}) {
  const toast = useToast();
  const decided = automation.passedCount + automation.failedCount;
  const successRate = decided ? Math.round((automation.passedCount / decided) * 100) : 0;

  const quickActions = [
    { label: 'View Code', icon: Code2, onClick: () => onNavigate('code') },
    { label: 'Run Tests', icon: Play, onClick: () => onNavigate('runs') },
    {
      label: 'Download Project',
      icon: Download,
      onClick: () => toast.push('Project export ships with the execution runtime', 'info'),
    },
    {
      label: 'Open in IDE',
      icon: FileCode2,
      onClick: () => toast.push('IDE hand-off ships with the execution runtime', 'info'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value={automation.testCount} label="Total Tests" accent="ink" />
        <StatTile value={automation.passedCount} label="Passed" accent="pass" />
        <StatTile value={automation.failedCount} label="Failed" accent="fail" />
        <StatTile value={`${successRate}%`} label="Success Rate" accent="accent" />
      </div>

      {automation.description && (
        <SectionCard title="Description">
          <p className="text-sm text-ink">{automation.description}</p>
        </SectionCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Project Structure">
          <ul className="space-y-1.5 text-sm">
            {SCAFFOLD_FOLDERS.map((folder) => {
              const isTests = folder.name === 'tests';
              return (
                <li key={folder.name}>
                  <div className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 font-mono text-ink">
                    <FolderClosed aria-hidden className="h-4 w-4 text-warn" />
                    <span className="font-semibold">{folder.name}/</span>
                    <span className="ml-auto text-xs text-muted">
                      {isTests ? `${tests.length} file(s)` : folder.hint}
                    </span>
                  </div>
                  {isTests && tests.length > 0 && (
                    <ul className="ml-6 border-l border-line pl-3">
                      {tests.slice(0, 8).map((test) => (
                        <li
                          key={test.id}
                          className="flex items-center gap-2 py-1 font-mono text-xs text-muted"
                        >
                          <FileCode2 aria-hidden className="h-3.5 w-3.5 text-accent-deep" />
                          {test.key.toLowerCase()}.spec.ts
                        </li>
                      ))}
                      {tests.length > 8 && (
                        <li className="py-1 pl-5 text-xs text-muted/70">
                          +{tests.length - 8} more
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="flex flex-col items-start gap-2 rounded-card border border-line bg-cream/40 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary-tint/40"
              >
                <action.icon aria-hidden className="h-5 w-5 text-primary-deep" />
                <span className="text-sm font-semibold text-ink">{action.label}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- settings */

const FRAMEWORK_OPTIONS = (Object.keys(FRAMEWORK_LABELS) as AutomationFramework[]).map((value) => ({
  value,
  label: FRAMEWORK_LABELS[value],
}));
const BROWSER_OPTIONS = [
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'webkit', label: 'WebKit' },
];

type SettingsTabKey = 'framework' | 'environments' | 'notifications' | 'advanced';

const SETTINGS_TABS: { key: SettingsTabKey; label: string }[] = [
  { key: 'framework', label: 'Framework' },
  { key: 'environments', label: 'Environments' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'advanced', label: 'Advanced' },
];

function SettingsTab({
  api,
  automation,
  onSaved,
}: {
  api: AutomationApi;
  automation: Automation;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [section, setSection] = useState<SettingsTabKey>('framework');

  const [framework, setFramework] = useState<AutomationFramework>(automation.framework);
  const [defaultBrowser, setDefaultBrowser] = useState(
    automation.config.defaultBrowser ?? 'chromium',
  );
  const [baseUrl, setBaseUrl] = useState(automation.config.baseUrl ?? '');
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    String(automation.config.timeoutSeconds ?? 60),
  );
  const [environments, setEnvironments] = useState<AutomationEnvironment[]>(
    automation.config.environments ?? [],
  );
  const [parallelExecution, setParallelExecution] = useState(
    automation.config.parallelExecution ?? false,
  );
  const [retryOnFailure, setRetryOnFailure] = useState(automation.config.retryOnFailure ?? true);
  const [retries, setRetries] = useState(String(automation.config.retries ?? 1));
  const [notifyOnFailure, setNotifyOnFailure] = useState(
    automation.config.notifyOnFailure ?? false,
  );
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(
    automation.config.notifyOnSuccess ?? false,
  );
  const [ciProvider, setCiProvider] = useState(automation.config.ciProvider ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.update(automation.id, {
        framework,
        config: {
          ...automation.config,
          defaultBrowser,
          baseUrl: baseUrl.trim() || undefined,
          timeoutSeconds: Number(timeoutSeconds) || 60,
          environments: environments.filter((env) => env.name.trim()),
          parallelExecution,
          retryOnFailure,
          retries: Number(retries) || 0,
          notifyOnFailure,
          notifyOnSuccess,
          ciProvider: ciProvider.trim() || undefined,
        },
      });
      toast.push('Settings saved', 'success');
      await onSaved();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {SETTINGS_TABS.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'border-accent text-accent-deep'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {section === 'framework' && (
        <SectionCard title="Framework">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Framework
              <Select
                options={FRAMEWORK_OPTIONS}
                value={framework}
                onChange={(value) => setFramework(value as AutomationFramework)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Default browser
              <Select
                options={BROWSER_OPTIONS}
                value={defaultBrowser}
                onChange={setDefaultBrowser}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
              Base URL
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className={inputClasses}
                placeholder="https://app.example.com"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Timeout (seconds)
              <input
                type="number"
                min={0}
                value={timeoutSeconds}
                onChange={(event) => setTimeoutSeconds(event.target.value)}
                className={inputClasses}
              />
            </label>
          </div>
        </SectionCard>
      )}

      {section === 'environments' && (
        <SectionCard
          title="Environments"
          action={
            <button
              type="button"
              onClick={() => setEnvironments((list) => [...list, { name: '', baseUrl: '' }])}
              className={ghostButton}
            >
              <Plus aria-hidden className="h-4 w-4" />
              Add environment
            </button>
          }
        >
          {environments.length === 0 ? (
            <p className="text-sm text-muted">
              No environments yet. Add one — it becomes selectable on the Run dialog.
            </p>
          ) : (
            <ul className="space-y-2">
              {environments.map((env, index) => (
                <li key={index} className="flex items-center gap-2">
                  <input
                    value={env.name}
                    onChange={(event) =>
                      setEnvironments((list) =>
                        list.map((e, i) => (i === index ? { ...e, name: event.target.value } : e)),
                      )
                    }
                    placeholder="Name, e.g. Staging"
                    className={`${inputClasses} sm:max-w-[12rem]`}
                  />
                  <input
                    value={env.baseUrl ?? ''}
                    onChange={(event) =>
                      setEnvironments((list) =>
                        list.map((e, i) =>
                          i === index ? { ...e, baseUrl: event.target.value } : e,
                        ),
                      )
                    }
                    placeholder="https://staging.example.com"
                    className={inputClasses}
                  />
                  <button
                    type="button"
                    aria-label="Remove environment"
                    onClick={() => setEnvironments((list) => list.filter((_, i) => i !== index))}
                    className="shrink-0 p-2 text-muted transition-colors hover:text-fail"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {section === 'notifications' && (
        <SectionCard title="Notifications">
          <div className="space-y-3">
            <Toggle
              checked={notifyOnFailure}
              onChange={setNotifyOnFailure}
              label="Notify on failure"
              hint="Email the team when a run fails"
            />
            <Toggle
              checked={notifyOnSuccess}
              onChange={setNotifyOnSuccess}
              label="Notify on success"
              hint="Email the team when a run passes"
            />
          </div>
        </SectionCard>
      )}

      {section === 'advanced' && (
        <div className="space-y-6">
          <SectionCard title="Execution">
            <div className="space-y-3">
              <Toggle
                checked={parallelExecution}
                onChange={setParallelExecution}
                label="Parallel execution"
                hint="Run independent tests concurrently across workers"
              />
              <Toggle
                checked={retryOnFailure}
                onChange={setRetryOnFailure}
                label="Retry on failure"
                hint="Re-run a failed test before reporting"
              />
              <label className="flex max-w-[12rem] flex-col gap-1.5 text-sm font-semibold text-ink">
                Retries
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={retries}
                  onChange={(event) => setRetries(event.target.value)}
                  className={inputClasses}
                />
              </label>
            </div>
          </SectionCard>
          <SectionCard title="Integrations">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              CI/CD provider
              <input
                value={ciProvider}
                onChange={(event) => setCiProvider(event.target.value)}
                className={inputClasses}
                placeholder="e.g. GitHub Actions"
              />
              <span className="text-xs font-normal text-muted">
                Pipeline wiring ships with the execution runtime — this records your intended
                provider.
              </span>
            </label>
          </SectionCard>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button type="button" disabled={saving} onClick={save} className={primaryButton}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- edit details modal */

function EditAutomationModal({
  api,
  automation,
  onClose,
  onSaved,
}: {
  api: AutomationApi;
  automation: Automation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(automation.name);
  const [description, setDescription] = useState(automation.description ?? '');
  const [status, setStatus] = useState(automation.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.push('A name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.update(automation.id, {
        name: name.trim(),
        description: description.trim() || null,
        status,
      });
      toast.push('Automation updated', 'success');
      onSaved();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to update', 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit automation" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Status
          <Select
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={status}
            onChange={(value) => setStatus(value as Automation['status'])}
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>
          Cancel
        </button>
        <button type="button" disabled={saving} onClick={save} className={primaryButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
