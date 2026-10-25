'use client';

import {
  FileText,
  FileUp,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { useToast } from '../../../toast';
import { useActiveProject } from '../../use-active-project';
import { Select } from '../../select';
import { designApi } from '../api';
import {
  Stepper,
  ghostButton,
  inputClasses,
  primaryButton,
} from '../design-ui';
import { DescriptionEditor } from '../description-editor';
import { Markdown } from '../markdown';
import type { DesignSource, RequirementPriority } from '@cognitest/shared';

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

type Phase = 'source' | 'basic' | 'requirements' | 'review';

const MAIN_STEPS = ['Basic Info', 'Requirements', 'Review'];
const PHASE_STEP: Record<Exclude<Phase, 'source'>, number> = {
  basic: 0,
  requirements: 1,
  review: 2,
};

const SOURCES: { id: DesignSource; title: string; blurb: string; icon: typeof PenLine }[] = [
  { id: 'manual', title: 'Manual', blurb: 'Enter requirements manually', icon: PenLine },
  { id: 'document', title: 'Document', blurb: 'Upload existing documentation', icon: FileUp },
  { id: 'jira', title: 'JIRA', blurb: 'Import JIRA issues', icon: Search },
];

interface DraftRequirement {
  key: number;
  title: string;
  description: string;
  priority: RequirementPriority;
}

let draftKey = 0;
const emptyDraft = (): DraftRequirement => ({
  key: ++draftKey,
  title: '',
  description: '',
  priority: 'medium',
});

export function NewDesignWizard({
  organizationId,
  projects,
}: {
  organizationId: string;
  projects: Project[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [activeProject] = useActiveProject(organizationId, projects);

  const [phase, setPhase] = useState<Phase>('source');
  const [source, setSource] = useState<DesignSource | null>(null);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(activeProject?.id ?? projects[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [drafts, setDrafts] = useState<DraftRequirement[]>([emptyDraft()]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const filledRequirements = drafts.filter((d) => d.title.trim());

  async function create() {
    if (!name.trim() || !projectId) {
      toast.push('A name and project are required', 'error');
      setPhase('basic');
      return;
    }
    setSaving(true);
    try {
      const api = designApi(organizationId, projectId);
      const { design } = await api.createDesign({
        name: name.trim(),
        description: description.trim() || undefined,
        source: source ?? 'manual',
      });
      for (const draft of filledRequirements) {
        await api.createRequirement(design.id, {
          title: draft.title.trim(),
          description: draft.description.trim() || undefined,
          priority: draft.priority,
          source: source ?? 'manual',
        });
      }
      toast.push('Test design created', 'success');
      router.push(`/${organizationId}/design/${design.id}?project=${projectId}`);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to create design', 'error');
      setSaving(false);
    }
  }

  function updateDraft(key: number, patch: Partial<DraftRequirement>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-deep">Create Test Design</h1>
        <p className="mt-1 text-sm text-muted">Start by adding your requirements.</p>
      </div>

      {phase !== 'source' && (
        <div className="mb-6 rounded-card border border-line bg-white px-5 py-4">
          <Stepper steps={MAIN_STEPS} current={PHASE_STEP[phase]} />
        </div>
      )}

      {phase === 'source' && (
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">What would you like to use?</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {SOURCES.map((item) => {
              const active = source === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSource(item.id)}
                  className={`flex flex-col items-center gap-3 rounded-card border-2 p-6 text-center transition-colors ${
                    active
                      ? 'border-accent bg-accent-tint/50'
                      : 'border-line bg-white hover:border-primary/50 hover:bg-primary-tint/30'
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
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
              onClick={() => router.push(`/${organizationId}/design`)}
              className={ghostButton}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!source}
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
          <h2 className="text-lg font-bold text-ink">Design Information</h2>
          <div className="mt-5 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>
                Design name <span className="text-fail">*</span>
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClasses}
                placeholder="e.g. Payment Checkout Testing"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              <span>
                Project <span className="text-fail">*</span>
              </span>
              <Select options={projectOptions} value={projectId} onChange={setProjectId} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Description
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${inputClasses} resize-y`}
                placeholder="What this design covers…"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-between gap-2">
            <button type="button" onClick={() => setPhase('source')} className={ghostButton}>
              ← Back
            </button>
            <button
              type="button"
              disabled={!name.trim() || !projectId}
              onClick={() => setPhase('requirements')}
              className={primaryButton}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {phase === 'requirements' && (
        <div className="rounded-card border border-line bg-white p-6">
          {source === 'document' && (
            <>
              <DocumentUpload files={files} onChange={setFiles} />
              <div className="mb-5 flex items-start gap-3 rounded-card border border-accent/30 bg-accent-tint/40 p-4">
                <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" />
                <p className="text-sm text-accent-deep">
                  Automatic extraction is coming soon, so uploaded files aren’t processed yet — add
                  the requirements manually below for now.
                </p>
              </div>
            </>
          )}
          {source === 'jira' && (
            <div className="mb-5 flex items-start gap-3 rounded-card border border-accent/30 bg-accent-tint/40 p-4">
              <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" />
              <p className="text-sm text-accent-deep">
                <span className="font-bold">JIRA</span> import is coming soon. For now, add the
                requirements manually below — you can re-import once it ships.
              </p>
            </div>
          )}

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Requirements</h2>
            <button
              type="button"
              onClick={() => setDrafts((list) => [...list, emptyDraft()])}
              className={primaryButton}
            >
              <Plus aria-hidden className="h-4 w-4" />
              Add Requirement
            </button>
          </div>

          <div className="space-y-4">
            {drafts.map((draft, index) => (
              <div key={draft.key} className="rounded-card border border-line bg-cream/50 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                    Requirement {index + 1}
                  </h3>
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove requirement"
                      onClick={() => setDrafts((list) => list.filter((d) => d.key !== draft.key))}
                      className="text-muted transition-colors hover:text-fail"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <input
                    value={draft.title}
                    onChange={(event) => updateDraft(draft.key, { title: event.target.value })}
                    placeholder="Title, e.g. User login"
                    className={inputClasses}
                  />
                  <DescriptionEditor
                    value={draft.description}
                    onChange={(markdown) => updateDraft(draft.key, { description: markdown })}
                    placeholder="Describe the requirement — bold, lists, tables…"
                  />
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:max-w-xs">
                    Priority
                    <Select
                      options={PRIORITY_OPTIONS}
                      value={draft.priority}
                      onChange={(value) =>
                        updateDraft(draft.key, { priority: value as RequirementPriority })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between gap-2">
            <button type="button" onClick={() => setPhase('basic')} className={ghostButton}>
              ← Back
            </button>
            <button type="button" onClick={() => setPhase('review')} className={primaryButton}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Review</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Review label="Name" value={name} />
            <Review
              label="Project"
              value={projects.find((p) => p.id === projectId)?.name ?? '—'}
            />
            <Review label="Source" value={source ?? 'manual'} />
            <Review label="Requirements" value={String(filledRequirements.length)} />
          </dl>

          {filledRequirements.length > 0 && (
            <ul className="mt-5 divide-y divide-line rounded-card border border-line">
              {filledRequirements.map((draft, index) => (
                <li key={draft.key} className="px-4 py-2.5">
                  <p className="text-sm font-semibold text-ink">
                    <span className="mr-2 font-mono text-xs text-accent-deep">
                      REQ-{String(index + 1).padStart(3, '0')}
                    </span>
                    {draft.title}
                  </p>
                  {draft.description.trim() && (
                    <div className="mt-1.5">
                      <Markdown source={draft.description} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex justify-between gap-2">
            <button type="button" onClick={() => setPhase('requirements')} className={ghostButton}>
              ← Back
            </button>
            <button type="button" disabled={saving} onClick={create} className={primaryButton}>
              {saving ? 'Creating…' : 'Create Test Design'}
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
      <dd className="mt-0.5 text-sm font-semibold capitalize text-ink">{value}</dd>
    </div>
  );
}

/* ----------------------------------------------------- document upload (staging) */

const ACCEPT_EXTENSIONS = ['pdf', 'md', 'markdown', 'doc', 'docx'];
const ACCEPT_ATTR = '.pdf,.md,.markdown,.doc,.docx';
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function accept(list: FileList | null) {
    if (!list) return;
    const added: File[] = [];
    for (const file of Array.from(list)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ACCEPT_EXTENSIONS.includes(ext)) {
        toast.push(`${file.name}: only PDF, Markdown or Word files are allowed`, 'error');
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.push(`${file.name}: exceeds the ${MAX_MB} MB limit`, 'error');
        continue;
      }
      if (files.some((f) => f.name === file.name && f.size === file.size)) continue;
      added.push(file);
    }
    if (added.length) onChange([...files, ...added]);
  }

  return (
    <div className="mb-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-card border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-tint/40' : 'border-line bg-cream/40'
        }`}
      >
        <UploadCloud aria-hidden className="h-8 w-8 text-primary" />
        <p className="mt-2 text-sm text-ink">
          Drag &amp; drop files here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-accent hover:text-accent-deep"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-muted">
          PDF, Markdown or Word (.doc, .docx) · up to {MAX_MB} MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(event) => {
            accept(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-[10px] border border-line bg-white px-4 py-2.5"
            >
              <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted">{formatSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="shrink-0 text-muted transition-colors hover:text-fail"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
