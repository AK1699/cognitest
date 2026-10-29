'use client';

import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ListChecks,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { TestCasePriority } from '@cognitest/shared';

import { Modal } from '../../modal';
import { Select } from '../../select';
import { useToast } from '../../../toast';
import { ConfirmModal } from '../../design/confirm-modal';
import { PriorityBadge } from '../../design/design-ui';
import type { Automation, AutomationApi, AutomationTest, TestStep } from '../api';
import {
  SectionCard,
  TestStatusTag,
  ghostButton,
  inputClasses,
  primaryButton,
} from '../automation-ui';
import { Toggle } from '../toggle';

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function TestsPanel({
  api,
  automationId,
  automation,
  onChange,
}: {
  api: AutomationApi;
  automationId: string;
  automation: Automation;
  onChange: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [tests, setTests] = useState<AutomationTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = useCallback(async () => {
    const { tests: fresh } = await api.listTests(automationId);
    setTests(fresh);
  }, [api, automationId]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .listTests(automationId)
      .then(({ tests: fresh }) => {
        if (live) setTests(fresh);
      })
      .catch((cause: unknown) => {
        if (live) toast.push(cause instanceof Error ? cause.message : 'Failed to load tests', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, automationId, toast]);

  async function refresh() {
    await load();
    await onChange();
  }

  async function generate() {
    setGenerating(true);
    try {
      const { generated } = await api.generate(automationId);
      toast.push(
        generated > 0 ? `Generated ${generated} test(s)` : 'No new tests to generate',
        generated > 0 ? 'success' : 'info',
      );
      setShowGenerate(false);
      await refresh();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to generate', 'error');
    } finally {
      setGenerating(false);
    }
  }

  const selected = tests.find((t) => t.id === selectedId) ?? null;

  if (selected) {
    return (
      <TestDetail
        api={api}
        automationId={automationId}
        test={selected}
        onBack={() => setSelectedId(null)}
        onChanged={async () => {
          await refresh();
        }}
        onDeleted={async () => {
          setSelectedId(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          {tests.length} test{tests.length === 1 ? '' : 's'}
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowGenerate(true)} className={ghostButton}>
            <Sparkles aria-hidden className="h-4 w-4 text-accent" />
            Generate
          </button>
          <button type="button" onClick={() => setAdding(true)} className={primaryButton}>
            <Plus aria-hidden className="h-4 w-4" />
            Add Test
          </button>
        </div>
      </div>

      {loading ? (
        <p className="rounded-card border border-line bg-white p-10 text-center text-sm text-muted">
          Loading…
        </p>
      ) : tests.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-white p-10 text-center">
          <ListChecks aria-hidden className="mx-auto h-8 w-8 text-muted/60" />
          <p className="mt-3 text-sm text-muted">
            No tests yet. Generate them from your test cases or add one manually.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {tests.map((test) => (
            <li key={test.id}>
              <button
                type="button"
                onClick={() => setSelectedId(test.id)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-primary-tint/30"
              >
                <span className="font-mono text-xs font-bold text-accent-deep">{test.key}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {test.title}
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  {test.steps.length} step{test.steps.length === 1 ? '' : 's'}
                </span>
                <PriorityBadge priority={test.priority} />
                <TestStatusTag status={test.lastStatus} />
                <ChevronRight aria-hidden className="h-4 w-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddTestModal
          api={api}
          automationId={automationId}
          onClose={() => setAdding(false)}
          onCreated={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      )}

      {showGenerate && (
        <GenerateModal
          framework={automation.framework}
          generating={generating}
          onClose={() => setShowGenerate(false)}
          onGenerate={generate}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- test detail */

type DetailTab = 'details' | 'steps' | 'data' | 'traceability';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'steps', label: 'Steps' },
  { key: 'data', label: 'Data' },
  { key: 'traceability', label: 'Traceability' },
];

function TestDetail({
  api,
  automationId,
  test,
  onBack,
  onChanged,
  onDeleted,
}: {
  api: AutomationApi;
  automationId: string;
  test: AutomationTest;
  onBack: () => void;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<DetailTab>('details');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function setStatus(status: AutomationTest['lastStatus']) {
    try {
      await api.updateTest(automationId, test.id, { status });
      toast.push('Test status updated', 'success');
      await onChanged();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to update', 'error');
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await api.deleteTest(automationId, test.id);
      toast.push('Test deleted', 'success');
      await onDeleted();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to delete', 'error');
    }
  }

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <button type="button" onClick={onBack} className="hover:text-primary-deep">
          Tests
        </button>
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        <span className="font-mono font-semibold text-ink">{test.key}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-primary-deep">{test.title}</h2>
            <PriorityBadge priority={test.priority} />
            <TestStatusTag status={test.lastStatus} />
          </div>
          {test.category && (
            <p className="mt-1 text-sm text-muted">Category: {test.category}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-semibold text-fail transition-colors hover:bg-fail-tint/50"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-6 border-b border-line">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {DETAIL_TABS.map((item) => {
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

      {tab === 'details' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Description">
            <p className="text-sm text-ink">
              {test.description || <span className="text-muted">No description.</span>}
            </p>
            {test.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {test.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-deep"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
          <div className="space-y-6">
            <SectionCard title="Preconditions">
              {test.preconditions.length === 0 ? (
                <p className="text-sm text-muted">None.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                  {test.preconditions.map((pre, index) => (
                    <li key={index}>{pre}</li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Expected Result">
              <p className="text-sm text-ink">
                {test.expectedResult || <span className="text-muted">Not specified.</span>}
              </p>
            </SectionCard>
            <SectionCard title="Outcome">
              <div className="flex flex-wrap gap-2">
                {(['passed', 'failed', 'skipped', 'not_run'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void setStatus(status)}
                    className={`rounded-[10px] border px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                      test.lastStatus === status
                        ? 'border-accent bg-accent-tint/60 text-accent-deep'
                        : 'border-line bg-white text-muted hover:bg-primary-tint/40'
                    }`}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                Set manually until the execution runtime reports live outcomes.
              </p>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === 'steps' && (
        <SectionCard title="Test Steps">
          {test.steps.length === 0 ? (
            <p className="text-sm text-muted">No steps recorded.</p>
          ) : (
            <ol className="space-y-2">
              {test.steps.map((step, index) => (
                <li key={index} className="flex gap-3 rounded-[10px] border border-line bg-cream/40 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary-deep">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{step.action}</p>
                    {step.expected && (
                      <p className="mt-0.5 text-xs text-muted">Expected: {step.expected}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      )}

      {tab === 'data' && (
        <SectionCard title="Test Data">
          <p className="text-sm text-muted">
            Data-driven inputs (parameter sets, fixtures) are managed here once the execution runtime
            is connected. For now, tests run with their recorded values.
          </p>
        </SectionCard>
      )}

      {tab === 'traceability' && (
        <SectionCard title="Traceability">
          <p className="text-sm text-muted">
            Links back to the requirements and test cases this automation covers. Wiring to the
            Design module&rsquo;s traceability graph ships in a later phase.
          </p>
        </SectionCard>
      )}

      {editing && (
        <EditTestModal
          api={api}
          automationId={automationId}
          test={test}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete test"
          message={`Delete "${test.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- steps editor */

function StepsEditor({ steps, onChange }: { steps: TestStep[]; onChange: (steps: TestStep[]) => void }) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-2 rounded-[10px] border border-line bg-cream/40 p-2.5">
          <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-bold text-primary-deep">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              value={step.action}
              onChange={(event) =>
                onChange(steps.map((s, i) => (i === index ? { ...s, action: event.target.value } : s)))
              }
              placeholder="Action, e.g. Click the login button"
              className={inputClasses}
            />
            <input
              value={step.expected ?? ''}
              onChange={(event) =>
                onChange(
                  steps.map((s, i) =>
                    i === index ? { ...s, expected: event.target.value || undefined } : s,
                  ),
                )
              }
              placeholder="Expected result (optional)"
              className={inputClasses}
            />
          </div>
          <button
            type="button"
            aria-label="Remove step"
            onClick={() => onChange(steps.filter((_, i) => i !== index))}
            className="self-start p-1 text-muted transition-colors hover:text-fail"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, { action: '' }])}
        className={ghostButton}
      >
        <Plus aria-hidden className="h-4 w-4" />
        Add step
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- add / edit modals */

function AddTestModal({
  api,
  automationId,
  onClose,
  onCreated,
}: {
  api: AutomationApi;
  automationId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TestCasePriority>('medium');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<TestStep[]>([{ action: '' }]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.push('A title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createTest(automationId, {
        title: title.trim(),
        priority,
        description: description.trim() || undefined,
        steps: steps.filter((s) => s.action.trim()),
      });
      toast.push('Test added', 'success');
      await onCreated();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to add test', 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title="Add test" onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClasses}
            placeholder="e.g. Valid login"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Priority
          <Select
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(value) => setPriority(value as TestCasePriority)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Description
          <textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Steps
          <StepsEditor steps={steps} onChange={setSteps} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>
          Cancel
        </button>
        <button type="button" disabled={saving} onClick={save} className={primaryButton}>
          {saving ? 'Adding…' : 'Add test'}
        </button>
      </div>
    </Modal>
  );
}

function EditTestModal({
  api,
  automationId,
  test,
  onClose,
  onSaved,
}: {
  api: AutomationApi;
  automationId: string;
  test: AutomationTest;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(test.title);
  const [priority, setPriority] = useState<TestCasePriority>(test.priority);
  const [category, setCategory] = useState(test.category ?? '');
  const [description, setDescription] = useState(test.description ?? '');
  const [expectedResult, setExpectedResult] = useState(test.expectedResult ?? '');
  const [preconditions, setPreconditions] = useState(test.preconditions.join('\n'));
  const [steps, setSteps] = useState<TestStep[]>(test.steps.length ? test.steps : [{ action: '' }]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.push('A title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.updateTest(automationId, test.id, {
        title: title.trim(),
        priority,
        category: category.trim() || null,
        description: description.trim() || null,
        expectedResult: expectedResult.trim() || null,
        preconditions: preconditions
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        steps: steps.filter((s) => s.action.trim()),
      });
      toast.push('Test updated', 'success');
      await onSaved();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to update', 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${test.key}`} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClasses}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Priority
            <Select
              options={PRIORITY_OPTIONS}
              value={priority}
              onChange={(value) => setPriority(value as TestCasePriority)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClasses}
              placeholder="e.g. Functional"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Description
          <textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Preconditions <span className="font-normal text-muted">(one per line)</span>
          <textarea
            rows={2}
            value={preconditions}
            onChange={(event) => setPreconditions(event.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Expected result
          <textarea
            rows={2}
            value={expectedResult}
            onChange={(event) => setExpectedResult(event.target.value)}
            className={`${inputClasses} resize-y`}
          />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Steps
          <StepsEditor steps={steps} onChange={setSteps} />
        </div>
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

/* ------------------------------------------------------------- generate modal */

const SOURCES = [
  { key: 'requirements', label: 'Approved Requirements' },
  { key: 'analysis', label: 'Analysis & Impact' },
  { key: 'gaps', label: 'Coverage Gaps' },
  { key: 'repository', label: 'Repository Intelligence' },
  { key: 'existing', label: 'Existing Tests' },
];

const ARTIFACTS = [
  { key: 'plan', label: 'Test Plan' },
  { key: 'suites', label: 'Test Suites' },
  { key: 'cases', label: 'Test Cases' },
];

const STRATEGY_OPTIONS = [
  { value: 'comprehensive', label: 'Comprehensive' },
  { value: 'critical', label: 'Critical paths only' },
  { value: 'smoke', label: 'Smoke' },
];

/**
 * Mirrors the "Generate Test Artifacts" screen: pick sources + artifacts +
 * strategy. The backend currently generates test cases from the project's test
 * cases; the extra toggles are illustrative until the generation engine lands.
 */
function GenerateModal({
  framework,
  generating,
  onClose,
  onGenerate,
}: {
  framework: string;
  generating: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
}) {
  const [sources, setSources] = useState<Set<string>>(
    new Set(['requirements', 'analysis', 'gaps', 'existing']),
  );
  const [artifacts, setArtifacts] = useState<Set<string>>(new Set(['cases']));
  const [strategy, setStrategy] = useState('comprehensive');
  const [includeCoverage, setIncludeCoverage] = useState(true);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Generate Test Artifacts"
        className="w-full max-w-2xl rounded-card border border-line bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-primary-deep">Generate Test Artifacts</h2>
        <p className="mt-1 text-sm text-muted">
          Convert your approved design into executable {framework} test artifacts.
        </p>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {/* selected sources */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              Selected Sources
            </p>
            <div className="space-y-1.5">
              {SOURCES.map((source) => {
                const checked = sources.has(source.key);
                return (
                  <button
                    key={source.key}
                    type="button"
                    onClick={() => toggle(sources, setSources, source.key)}
                    className="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-cream/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/50"
                  >
                    {checked ? (
                      <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-pass" />
                    ) : (
                      <Circle aria-hidden className="h-4 w-4 shrink-0 text-muted/50" />
                    )}
                    <span className={checked ? 'text-ink' : 'text-muted'}>{source.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* generate */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Generate</p>
            <div className="space-y-1.5">
              {ARTIFACTS.map((artifact) => {
                const checked = artifacts.has(artifact.key);
                return (
                  <label
                    key={artifact.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-cream/40 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(artifacts, setArtifacts, artifact.key)}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span className={checked ? 'text-ink' : 'text-muted'}>{artifact.label}</span>
                  </label>
                );
              })}
            </div>

            <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Strategy
              <Select options={STRATEGY_OPTIONS} value={strategy} onChange={setStrategy} />
            </label>

            <div className="mt-4">
              <Toggle
                checked={includeCoverage}
                onChange={setIncludeCoverage}
                label="Include existing coverage"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-card border border-accent/30 bg-accent-tint/40 p-3">
          <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" />
          <p className="text-xs text-accent-deep">
            Tests are generated from this project&rsquo;s test cases. Source, artifact and strategy
            selection refine the output once the generation engine is connected.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={onGenerate}
            className={primaryButton}
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
