'use client';

import {
  Braces,
  Check,
  Clipboard,
  Crosshair,
  FileCode2,
  FolderClosed,
  Globe,
  MousePointerClick,
  Navigation,
  PlayCircle,
  Plus,
  Save,
  TextCursorInput,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import { Modal } from '../../modal';
import { useToast } from '../../../toast';
import type {
  Automation,
  AutomationApi,
  AutomationStep,
  AutomationTest,
  AutomationVariable,
} from '../api';
import { FRAMEWORK_LABELS, SectionCard, inputClasses, primaryButton } from '../automation-ui';

/* ============================================================ visual builder */

interface ActionType {
  type: string;
  label: string;
  icon: typeof Globe;
  category: string;
  fields: ('url' | 'selector' | 'value' | 'timeout' | 'expected' | 'code')[];
}

const ACTION_TYPES: ActionType[] = [
  { type: 'open_browser', label: 'Open Browser', icon: Globe, category: 'Browser', fields: [] },
  { type: 'navigate', label: 'Navigate to URL', icon: Navigation, category: 'Navigation', fields: ['url'] },
  { type: 'input', label: 'Enter Text', icon: TextCursorInput, category: 'Input', fields: ['selector', 'value'] },
  { type: 'click', label: 'Click', icon: MousePointerClick, category: 'Input', fields: ['selector'] },
  { type: 'wait', label: 'Wait', icon: Timer, category: 'Advanced', fields: ['timeout'] },
  { type: 'assert', label: 'Assert', icon: Check, category: 'Advanced', fields: ['selector', 'expected'] },
  { type: 'custom', label: 'Custom Code', icon: Zap, category: 'Custom', fields: ['code'] },
];

function actionMeta(type: string): ActionType {
  return ACTION_TYPES.find((a) => a.type === type) ?? ACTION_TYPES[ACTION_TYPES.length - 1]!;
}

function newStep(type: string): AutomationStep {
  const meta = actionMeta(type);
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${type}-${Date.now()}`,
    type,
    label: meta.label,
    config: {},
  };
}

export function BuilderPanel({
  api,
  automation,
  onChange,
}: {
  api: AutomationApi;
  automation: Automation;
  onChange: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [flow, setFlow] = useState<AutomationStep[]>(automation.flow);
  const [variables, setVariables] = useState<AutomationVariable[]>(
    automation.config.variables ?? [],
  );
  const [paletteTab, setPaletteTab] = useState<'actions' | 'variables'>('actions');
  const [selectedId, setSelectedId] = useState<string | null>(automation.flow[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const selected = flow.find((s) => s.id === selectedId) ?? null;

  function mutate(next: AutomationStep[]) {
    setFlow(next);
    setDirty(true);
  }

  function mutateVars(next: AutomationVariable[]) {
    setVariables(next);
    setDirty(true);
  }

  function addAction(type: string) {
    const step = newStep(type);
    mutate([...flow, step]);
    setSelectedId(step.id);
  }

  function updateSelected(patch: Partial<AutomationStep>) {
    if (!selected) return;
    mutate(flow.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  }

  function updateConfig(key: string, value: string) {
    if (!selected) return;
    mutate(
      flow.map((s) =>
        s.id === selected.id ? { ...s, config: { ...s.config, [key]: value } } : s,
      ),
    );
  }

  function removeStep(id: string) {
    mutate(flow.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function save() {
    setSaving(true);
    try {
      await api.update(automation.id, {
        flow,
        config: { ...automation.config, variables },
      });
      toast.push('Flow saved', 'success');
      setDirty(false);
      await onChange();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to save flow', 'error');
    } finally {
      setSaving(false);
    }
  }

  const categories = Array.from(new Set(ACTION_TYPES.map((a) => a.category)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">Visual Automation Builder</h2>
          <p className="text-sm text-muted">Compose your test flow — click an action to add it.</p>
        </div>
        <button type="button" disabled={saving || !dirty} onClick={save} className={primaryButton}>
          <Save aria-hidden className="h-4 w-4" />
          {saving ? 'Saving…' : dirty ? 'Save flow' : 'Saved'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr_280px]">
        {/* actions / variables palette */}
        <div className="rounded-card border border-line bg-white p-3">
          <div className="mb-3 flex gap-1 rounded-[10px] border border-line p-0.5">
            {(['actions', 'variables'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPaletteTab(key)}
                className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-bold capitalize transition-colors ${
                  paletteTab === key ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {paletteTab === 'actions' ? (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category}>
                  <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-muted/70">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {ACTION_TYPES.filter((a) => a.category === category).map((action) => (
                      <button
                        key={action.type}
                        type="button"
                        draggable
                        onDragStart={(event) =>
                          event.dataTransfer.setData('text/plain', action.type)
                        }
                        onClick={() => addAction(action.type)}
                        className="flex w-full items-center gap-2 rounded-[8px] border border-line bg-cream/40 px-2 py-1.5 text-left text-xs font-semibold text-ink transition-colors hover:border-primary/50 hover:bg-primary-tint/40"
                      >
                        <action.icon aria-hidden className="h-3.5 w-3.5 text-primary-deep" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <VariablesEditor variables={variables} onChange={mutateVars} />
          )}
        </div>

        {/* canvas */}
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('text/plain');
            if (type) addAction(type);
          }}
          className="min-h-[24rem] rounded-card border border-line bg-cream/30 p-4"
        >
          <div className="mx-auto flex max-w-md flex-col items-stretch gap-0">
            <div className="flex items-center justify-center gap-2 rounded-[10px] bg-pass-tint px-4 py-2.5 text-sm font-bold text-pass">
              <PlayCircle aria-hidden className="h-4 w-4" />
              Start
            </div>
            {flow.map((step) => {
              const meta = actionMeta(step.type);
              const active = step.id === selectedId;
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <span aria-hidden className="h-5 w-px bg-line" />
                  <button
                    type="button"
                    onClick={() => setSelectedId(step.id)}
                    className={`flex w-full items-center gap-3 rounded-[10px] border-2 bg-white px-4 py-2.5 text-left transition-colors ${
                      active ? 'border-accent bg-accent-tint/40' : 'border-line hover:border-primary/50'
                    }`}
                  >
                    <meta.icon aria-hidden className="h-4 w-4 shrink-0 text-primary-deep" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{step.label}</span>
                      {Boolean(
                        step.config?.selector ?? step.config?.url ?? step.config?.value,
                      ) && (
                        <span className="block truncate font-mono text-[11px] text-muted">
                          {String(step.config?.url ?? step.config?.selector ?? step.config?.value)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove step"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeStep(step.id);
                      }}
                      className="shrink-0 p-1 text-muted transition-colors hover:text-fail"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </button>
                </div>
              );
            })}
            <span aria-hidden className="h-5 w-px self-center bg-line" />
            <div className="flex items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line px-4 py-3 text-sm text-muted">
              <Plus aria-hidden className="h-4 w-4" />
              Drop or click an action to add
            </div>
          </div>
        </div>

        {/* action settings */}
        <div className="rounded-card border border-line bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Action Settings</p>
          {!selected ? (
            <p className="text-sm text-muted">Select an action to configure it.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
                Label
                <input
                  value={selected.label}
                  onChange={(event) => updateSelected({ label: event.target.value })}
                  className={inputClasses}
                />
              </label>
              {actionMeta(selected.type).fields.map((field) => {
                if (field === 'selector') {
                  return (
                    <div key={field} className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
                      Element locator
                      <div className="flex gap-2">
                        <input
                          value={String(selected.config?.selector ?? '')}
                          onChange={(event) => updateConfig('selector', event.target.value)}
                          placeholder="#email-input"
                          className={inputClasses}
                        />
                        <button
                          type="button"
                          aria-label="Pick element"
                          onClick={() => setPicking(true)}
                          className="shrink-0 rounded-[10px] border border-line px-2.5 text-muted transition-colors hover:bg-primary-tint hover:text-primary-deep"
                        >
                          <Crosshair aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                }
                const labels: Record<string, { label: string; placeholder: string }> = {
                  url: { label: 'URL', placeholder: 'https://app.example.com/login' },
                  value: { label: 'Value', placeholder: '{{user.email}}' },
                  timeout: { label: 'Timeout (seconds)', placeholder: '30' },
                  expected: { label: 'Expected', placeholder: 'Welcome message is visible' },
                  code: { label: 'Code', placeholder: 'await page.evaluate(...)' },
                };
                const meta = labels[field]!;
                return (
                  <label key={field} className="flex flex-col gap-1.5 text-xs font-semibold text-ink">
                    {meta.label}
                    <input
                      value={String(selected.config?.[field] ?? '')}
                      onChange={(event) => updateConfig(field, event.target.value)}
                      placeholder={meta.placeholder}
                      className={inputClasses}
                    />
                    {field === 'value' && variables.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {variables.map((variable) => (
                          <button
                            key={variable.name}
                            type="button"
                            onClick={() =>
                              updateConfig(
                                'value',
                                `${String(selected.config?.value ?? '')}{{${variable.name}}}`,
                              )
                            }
                            className="rounded-full bg-accent-tint px-2 py-0.5 font-mono text-[10px] font-bold text-accent-deep transition-colors hover:bg-accent hover:text-white"
                          >
                            {`{{${variable.name}}}`}
                          </button>
                        ))}
                      </span>
                    )}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => removeStep(selected.id)}
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-fail transition-colors hover:bg-fail-tint/50"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" />
                Delete action
              </button>
            </div>
          )}
        </div>
      </div>

      {picking && (
        <SelectElementModal
          onClose={() => setPicking(false)}
          onPick={(selector) => {
            updateConfig('selector', selector);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- variables */

function VariablesEditor({
  variables,
  onChange,
}: {
  variables: AutomationVariable[];
  onChange: (next: AutomationVariable[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[10px] text-muted/80">
        Reference these in step values as <span className="font-mono">{'{{name}}'}</span>.
      </p>
      {variables.length === 0 && (
        <p className="rounded-[8px] border border-dashed border-line px-2 py-3 text-center text-[11px] text-muted">
          No variables yet.
        </p>
      )}
      {variables.map((variable, index) => (
        <div key={index} className="space-y-1.5 rounded-[8px] border border-line bg-cream/40 p-2">
          <div className="flex items-center gap-1">
            <Braces aria-hidden className="h-3 w-3 shrink-0 text-accent-deep" />
            <input
              value={variable.name}
              onChange={(event) =>
                onChange(
                  variables.map((v, i) => (i === index ? { ...v, name: event.target.value } : v)),
                )
              }
              placeholder="name"
              className="min-w-0 flex-1 rounded-[6px] border border-line bg-white px-2 py-1 font-mono text-[11px] text-ink focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              aria-label="Remove variable"
              onClick={() => onChange(variables.filter((_, i) => i !== index))}
              className="shrink-0 p-0.5 text-muted transition-colors hover:text-fail"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            value={variable.value}
            onChange={(event) =>
              onChange(
                variables.map((v, i) => (i === index ? { ...v, value: event.target.value } : v)),
              )
            }
            placeholder="value"
            className="w-full rounded-[6px] border border-line bg-white px-2 py-1 text-[11px] text-ink focus:border-primary focus:outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...variables, { name: `var${variables.length + 1}`, value: '' }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint/40"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
        Add variable
      </button>
    </div>
  );
}

/* ========================================================== select element */

type LocatorStrategy = 'auto' | 'text' | 'role' | 'css' | 'testid';

const STRATEGIES: { key: LocatorStrategy; label: string }[] = [
  { key: 'auto', label: 'Auto-detect' },
  { key: 'text', label: 'Text' },
  { key: 'role', label: 'Role' },
  { key: 'css', label: 'CSS' },
  { key: 'testid', label: 'Test ID' },
];

const DETECTED = [
  { strategy: 'testid' as const, value: 'email-input', label: 'Test ID', recommended: true },
  { strategy: 'css' as const, value: '#email-input', label: 'CSS' },
  { strategy: 'role' as const, value: "getByRole('textbox')", label: 'Role' },
  { strategy: 'text' as const, value: "getByText('Email')", label: 'Text' },
];

function SelectElementModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (selector: string) => void;
}) {
  const [strategy, setStrategy] = useState<LocatorStrategy>('auto');

  const visible = DETECTED.filter((d) => strategy === 'auto' || d.strategy === strategy);

  return (
    <Modal title="Select Element" onClose={onClose}>
      <p className="text-sm text-muted">
        Click an element in the preview, or choose a detected locator below.
      </p>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-line">
        {STRATEGIES.map((item) => {
          const active = strategy === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setStrategy(item.key)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
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

      {/* preview */}
      <div className="mt-4 rounded-card border border-line bg-cream/40 p-4">
        <p className="mb-1 text-xs font-semibold text-ink">Email</p>
        <div className="rounded-[8px] border-2 border-accent bg-white px-3 py-2 text-sm text-muted">
          test@example.com
        </div>
        <p className="mb-1 mt-3 text-xs font-semibold text-ink">Password</p>
        <div className="rounded-[8px] border border-line bg-white px-3 py-2 text-sm text-muted">
          ••••••••
        </div>
        <div className="mt-3 rounded-[8px] bg-accent px-3 py-2 text-center text-sm font-bold text-white">
          Login
        </div>
      </div>

      {/* detected locators */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Detected locators</p>
        <ul className="space-y-1.5">
          {visible.map((locator) => (
            <li key={locator.value}>
              <button
                type="button"
                onClick={() => onPick(locator.value)}
                className="flex w-full items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary-tint/40"
              >
                <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {locator.label}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
                  {locator.value}
                </span>
                {locator.recommended && (
                  <span className="rounded-full bg-pass-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pass">
                    Recommended
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/* ================================================================ code view */

export function CodePanel({
  automation,
  tests,
}: {
  automation: Automation;
  tests: AutomationTest[];
}) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(tests[0]?.id ?? null);
  const selected = tests.find((t) => t.id === selectedId) ?? null;

  async function copy() {
    if (!selected?.code) return;
    try {
      await navigator.clipboard.writeText(selected.code);
      toast.push('Copied to clipboard', 'success');
    } catch {
      toast.push('Could not copy — check browser permissions', 'error');
    }
  }

  if (tests.length === 0) {
    return (
      <SectionCard title="Code">
        <p className="text-sm text-muted">
          No generated code yet. Add or generate tests on the Tests tab — each one produces a{' '}
          {FRAMEWORK_LABELS[automation.framework]} spec here.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="rounded-card border border-line bg-white p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <FolderClosed aria-hidden className="h-3.5 w-3.5 text-warn" />
          tests/
        </p>
        <ul className="space-y-0.5">
          {tests.map((test) => {
            const active = test.id === selectedId;
            return (
              <li key={test.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(test.id)}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                    active ? 'bg-primary-tint text-primary-deep' : 'text-ink hover:bg-primary-tint/50'
                  }`}
                >
                  <FileCode2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent-deep" />
                  <span className="truncate">{test.key.toLowerCase()}.spec.ts</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="overflow-hidden rounded-card border border-line">
        <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2">
          <span className="font-mono text-xs text-muted">
            {selected ? `${selected.key.toLowerCase()}.spec.ts` : 'Select a file'}
          </span>
          <button
            type="button"
            onClick={copy}
            disabled={!selected?.code}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-primary-tint disabled:opacity-50"
          >
            <Clipboard aria-hidden className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
        <div className="max-h-[32rem] overflow-auto bg-ink p-4">
          <pre className="font-mono text-xs leading-relaxed text-cream">
            {selected?.code ?? '// No code generated for this test yet.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
