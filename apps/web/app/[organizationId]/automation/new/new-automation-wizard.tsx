'use client';

import { ClipboardCheck, MousePointerClick, Upload, Video, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { AutomationFramework, AutomationMethod } from '@cognitest/shared';

import { useToast } from '../../../toast';
import { Select } from '../../select';
import { useActiveProject } from '../../use-active-project';
import { Stepper } from '../../design/design-ui';
import { automationApi, type AutomationConfig } from '../api';
import { FRAMEWORK_LABELS, ghostButton, inputClasses, primaryButton } from '../automation-ui';
import { Toggle } from '../toggle';

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

type Phase = 'method' | 'basic' | 'configure' | 'review';

const MAIN_STEPS = ['Basic Info', 'Configure', 'Review'];
const PHASE_STEP: Record<Exclude<Phase, 'method'>, number> = {
  basic: 0,
  configure: 1,
  review: 2,
};

const METHODS: {
  id: AutomationMethod;
  title: string;
  blurb: string;
  icon: typeof MousePointerClick;
  recommended?: boolean;
}[] = [
  {
    id: 'from_test_cases',
    title: 'From Test Cases',
    blurb: 'Generate automation from approved test cases in your design module',
    icon: ClipboardCheck,
  },
  {
    id: 'visual',
    title: 'Build Visually',
    blurb: 'Use drag & drop to compose automation flows',
    icon: MousePointerClick,
    recommended: true,
  },
  {
    id: 'record',
    title: 'Record Test',
    blurb: 'Record your actions in the browser',
    icon: Video,
  },
  {
    id: 'import',
    title: 'Import Existing',
    blurb: 'Upload a project or code repository',
    icon: Upload,
  },
];

const FRAMEWORK_OPTIONS = (Object.keys(FRAMEWORK_LABELS) as AutomationFramework[]).map((value) => ({
  value,
  label: FRAMEWORK_LABELS[value],
}));

const BROWSER_OPTIONS = [
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'webkit', label: 'WebKit' },
];

export function NewAutomationWizard({
  organizationId,
  projects,
}: {
  organizationId: string;
  projects: Project[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [activeProject] = useActiveProject(organizationId, projects);

  const [phase, setPhase] = useState<Phase>('method');
  const [method, setMethod] = useState<AutomationMethod | null>(null);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(activeProject?.id ?? projects[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const [framework, setFramework] = useState<AutomationFramework>('playwright');
  const [defaultBrowser, setDefaultBrowser] = useState('chromium');
  const [baseUrl, setBaseUrl] = useState('');
  const [parallelExecution, setParallelExecution] = useState(false);
  const [retryOnFailure, setRetryOnFailure] = useState(true);

  const [saving, setSaving] = useState(false);

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));

  function addTag() {
    const next = tagDraft.trim().replace(/,$/, '').trim();
    if (!next) return;
    if (!tags.includes(next) && tags.length < 20) setTags((list) => [...list, next]);
    setTagDraft('');
  }

  async function create() {
    if (!name.trim() || !projectId) {
      toast.push('A name and project are required', 'error');
      setPhase('basic');
      return;
    }
    setSaving(true);
    try {
      const api = automationApi(organizationId, projectId);
      const config: AutomationConfig = {
        defaultBrowser,
        parallelExecution,
        retryOnFailure,
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
      };
      const { automation } = await api.create({
        name: name.trim(),
        description: description.trim() || undefined,
        method: method ?? 'visual',
        framework,
        tags,
        config,
      });
      // "From Test Cases" seeds the automation immediately from project test cases
      if (method === 'from_test_cases') {
        try {
          const { generated } = await api.generate(automation.id);
          if (generated > 0) toast.push(`Generated ${generated} test(s)`, 'success');
        } catch {
          // generation is best-effort at creation; the user can retry on the Tests tab
        }
      }
      toast.push('Automation created', 'success');
      router.push(`/${organizationId}/automation/${automation.id}?project=${projectId}`);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to create automation', 'error');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-deep">Create Automation</h1>
        <p className="mt-1 text-sm text-muted">Choose how you want to create your automation.</p>
      </div>

      {phase !== 'method' && (
        <div className="mb-6 rounded-card border border-line bg-white px-5 py-4">
          <Stepper steps={MAIN_STEPS} current={PHASE_STEP[phase]} />
        </div>
      )}

      {phase === 'method' && (
        <div className="rounded-card border border-line bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {METHODS.map((item) => {
              const active = method === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMethod(item.id)}
                  className={`relative flex flex-col items-start gap-3 rounded-card border-2 p-6 text-left transition-colors ${
                    active
                      ? 'border-accent bg-accent-tint/50'
                      : 'border-line bg-white hover:border-primary/50 hover:bg-primary-tint/30'
                  }`}
                >
                  {item.recommended && (
                    <span className="absolute right-4 top-4 rounded-full bg-pass-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pass">
                      Recommended
                    </span>
                  )}
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-[10px] ${
                      active ? 'bg-accent text-white' : 'bg-primary-tint text-primary-deep'
                    }`}
                  >
                    <item.icon aria-hidden className="h-6 w-6" />
                  </span>
                  <span className="text-base font-bold text-ink">{item.title}</span>
                  <span className="text-xs text-muted">{item.blurb}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push(`/${organizationId}/automation`)}
              className={ghostButton}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!method}
              onClick={() => setPhase('basic')}
              className={primaryButton}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {phase === 'basic' && (
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Automation Details</h2>
          <div className="mt-5 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>
                Project <span className="text-fail">*</span>
              </span>
              <Select options={projectOptions} value={projectId} onChange={setProjectId} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>
                Name <span className="text-fail">*</span>
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClasses}
                placeholder="e.g. Login Automation"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Description
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${inputClasses} resize-y`}
                placeholder="What this automation covers…"
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Tags
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-white px-2.5 py-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-deep"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() => setTags((list) => list.filter((t) => t !== tag))}
                      className="hover:text-fail"
                    >
                      <X aria-hidden className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={addTag}
                  placeholder="Add tags…"
                  className="min-w-[8rem] flex-1 bg-transparent text-sm font-normal text-ink placeholder:text-muted/70 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-between gap-2">
            <button type="button" onClick={() => setPhase('method')} className={ghostButton}>
              ← Back
            </button>
            <button
              type="button"
              disabled={!name.trim() || !projectId}
              onClick={() => setPhase('configure')}
              className={primaryButton}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {phase === 'configure' && (
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Configuration</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
          </div>
          <div className="mt-5 space-y-3">
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
              hint="Automatically re-run a failed test once before reporting"
            />
          </div>
          <div className="mt-6 flex justify-between gap-2">
            <button type="button" onClick={() => setPhase('basic')} className={ghostButton}>
              ← Back
            </button>
            <button type="button" onClick={() => setPhase('review')} className={primaryButton}>
              Next →
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Review</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Review label="Name" value={name} />
            <Review label="Project" value={projects.find((p) => p.id === projectId)?.name ?? '—'} />
            <Review label="Method" value={METHODS.find((m) => m.id === method)?.title ?? '—'} />
            <Review label="Framework" value={FRAMEWORK_LABELS[framework]} />
            <Review label="Default browser" value={defaultBrowser} />
            <Review label="Base URL" value={baseUrl.trim() || '—'} />
          </dl>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-deep"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {method === 'from_test_cases' && (
            <p className="mt-4 rounded-card border border-accent/30 bg-accent-tint/40 p-4 text-sm text-accent-deep">
              Tests will be generated from this project&rsquo;s approved test cases as soon as the
              automation is created.
            </p>
          )}
          <div className="mt-6 flex justify-between gap-2">
            <button type="button" onClick={() => setPhase('configure')} className={ghostButton}>
              ← Back
            </button>
            <button type="button" disabled={saving} onClick={create} className={primaryButton}>
              {saving ? 'Creating…' : 'Create Automation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-cream/60 px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
