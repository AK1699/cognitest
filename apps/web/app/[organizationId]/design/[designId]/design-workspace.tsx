'use client';

import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileDown,
  FileSpreadsheet,
  FileText,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { DesignSource, RequirementPriority, RequirementStatus } from '@cognitest/shared';

import { Modal } from '../../modal';
import { Select } from '../../select';
import { useToast } from '../../../toast';
import { useActiveProject } from '../../use-active-project';
import {
  designApi,
  type Approval,
  type DesignApi,
  type IntegrationSummary,
  type Requirement,
  type TestCase,
  type TestDesign,
  type TestPlan,
  type TestSuite,
} from '../api';
import { EntityLinks, ImportRequirementsButton } from './links-panel';
import {
  PriorityBadge,
  ProgressRing,
  RequirementStatusBadge,
  SectionCard,
  SourceChip,
  StatusBadge,
  ghostButton,
  inputClasses,
  primaryButton,
} from '../design-ui';
import { ConfirmModal } from '../confirm-modal';
import { DescriptionEditor } from '../description-editor';
import { exportDesignExcel, exportDesignPdf, gatherDesignExport } from '../export-design';
import { Markdown } from '../markdown';

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

type TabKey =
  | 'overview'
  | 'requirements'
  | 'analysis'
  | 'impact'
  | 'coverage'
  | 'suggestions'
  | 'traceability'
  | 'approval'
  | 'artifacts';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'impact', label: 'Impact' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'suggestions', label: 'AI Suggestions' },
  { key: 'traceability', label: 'Traceability' },
  { key: 'approval', label: 'Approval' },
  { key: 'artifacts', label: 'Test Artifacts' },
];

export function DesignWorkspace({
  organizationId,
  designId,
  projects,
}: {
  organizationId: string;
  designId: string;
  projects: Project[];
}) {
  const toast = useToast();
  const [activeProject] = useActiveProject(organizationId, projects);
  const projectId = activeProject?.id ?? null;

  const router = useRouter();
  const [design, setDesign] = useState<TestDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const api = projectId ? designApi(organizationId, projectId) : null;

  const reload = useCallback(async () => {
    if (!api) return;
    const { design: fresh } = await api.getDesign(designId);
    setDesign(fresh);
  }, [api, designId]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    designApi(organizationId, projectId)
      .getDesign(designId)
      .then(({ design: fresh }) => {
        if (live) setDesign(fresh);
      })
      .catch((cause: unknown) => {
        if (live) toast.push(cause instanceof Error ? cause.message : 'Failed to load design', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organizationId, projectId, designId, toast]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  async function deleteDesign() {
    if (!api || !design) return;
    try {
      await api.deleteDesign(design.id);
      toast.push('Design deleted', 'success');
      router.push(`/${organizationId}/design`);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to delete', 'error');
    }
  }

  async function runExport(kind: 'pdf' | 'excel') {
    if (!api || !design) return;
    setMenuOpen(false);
    try {
      const data = await gatherDesignExport(api, designId);
      if (kind === 'pdf') {
        if (!exportDesignPdf(design, data, activeProject?.name)) {
          toast.push('Allow pop-ups to export as PDF', 'error');
        }
      } else {
        exportDesignExcel(design, data, activeProject?.name);
      }
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Export failed', 'error');
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (!api || !design) {
    return (
      <div>
        <Link href={`/${organizationId}/design`} className="text-sm text-accent hover:underline">
          ← Back to designs
        </Link>
        <p className="mt-4 rounded-card border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          This design could not be loaded. It may have been archived, or belong to another project.
        </p>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <Link href={`/${organizationId}/design`} className="hover:text-primary-deep">
          Design
        </Link>
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        <span className="font-semibold text-ink">{design.name}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary-deep">{design.name}</h1>
            <StatusBadge status={design.status} />
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {activeProject && <>Project: {activeProject.name}</>}
            <span className="text-line">•</span>
            <SourceChip source={design.source} />
            <span className="text-line">•</span>v{design.version}
          </p>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Design actions"
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
                Edit design
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void runExport('pdf')}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-primary-tint/60"
              >
                <FileDown aria-hidden className="h-4 w-4 text-muted" />
                Export as PDF
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void runExport('excel')}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-primary-tint/60"
              >
                <FileSpreadsheet aria-hidden className="h-4 w-4 text-muted" />
                Export as Excel
              </button>
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmArchive(true);
                }}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-fail transition-colors hover:bg-fail-tint/50"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Delete design
              </button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditDesignModal
          api={api}
          design={design}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}

      {confirmArchive && (
        <ConfirmModal
          title="Delete design"
          message={`Permanently delete "${design.name}"? This also removes its requirements, plans, suites and cases. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmArchive(false);
            void deleteDesign();
          }}
          onClose={() => setConfirmArchive(false)}
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
        <OverviewTab design={design} onReview={() => setTab('approval')} />
      )}
      {tab === 'requirements' && (
        <RequirementsTab
          api={api}
          designId={designId}
          designSource={design.source}
          onChange={reload}
        />
      )}
      {tab === 'analysis' && (
        <ComingSoon
          title="Requirement Analysis"
          note="Automatic scenario analysis (functional, negative, boundary, state) arrives with the AI phase."
        />
      )}
      {tab === 'impact' && (
        <ComingSoon
          title="Impact Analysis"
          note="Affected components, APIs and tests are derived once repository analysis is connected."
        />
      )}
      {tab === 'coverage' && <CoverageTab design={design} />}
      {tab === 'suggestions' && (
        <ComingSoon
          title="AI Test Suggestions"
          note="Generated test suggestions from coverage gaps and repository signals arrive with the AI phase."
        />
      )}
      {tab === 'traceability' && <TraceabilityTab api={api} design={design} />}
      {tab === 'approval' && <ApprovalTab api={api} design={design} onChange={reload} />}
      {tab === 'artifacts' && (
        <ArtifactsTab api={api} design={design} designId={designId} onChange={reload} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------- edit design modal */

function EditDesignModal({
  api,
  design,
  onClose,
  onSaved,
}: {
  api: DesignApi;
  design: TestDesign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(design.name);
  const [description, setDescription] = useState(design.description ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.push('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.updateDesign(design.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.push('Design updated', 'success');
      onSaved();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to update', 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit design" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          <span>
            Name <span className="text-fail">*</span>
          </span>
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
        <p className="text-xs text-muted">
          Source: <span className="font-semibold capitalize text-ink">{design.source}</span> — set at
          creation and can’t be changed.
        </p>
        {design.status === 'approved' && (
          <p className="rounded-[10px] bg-warn-tint/50 px-3 py-2 text-xs text-ink">
            This design is approved — saving changes starts a new version for re-approval.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButton}>
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={save} className={primaryButton}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- overview */

function OverviewTab({ design, onReview }: { design: TestDesign; onReview: () => void }) {
  const readiness = [
    { label: 'Requirements captured', done: design.requirementCount > 0 },
    { label: 'Test suites built', done: design.suiteCount > 0 },
    { label: 'Test cases written', done: design.caseCount > 0 },
    { label: 'Design approved', done: design.status === 'approved' },
  ];
  const complete = readiness.filter((r) => r.done).length;
  const progress = Math.round((complete / readiness.length) * 100);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <SectionCard title="Design Progress">
        <div className="flex items-center gap-5">
          <ProgressRing value={progress} colorClass="text-primary" />
          <div>
            <p className="text-sm font-semibold text-ink">Overall Completion</p>
            <p className="mt-1 text-xs text-muted">
              {complete} of {readiness.length} readiness checks complete
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Key Metrics">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { value: design.requirementCount, label: 'Requirements' },
            { value: design.suiteCount, label: 'Suites' },
            { value: design.caseCount, label: 'Cases' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[10px] bg-cream/60 py-4">
              <p className="text-2xl font-bold text-primary-deep">{metric.value}</p>
              <p className="mt-0.5 text-xs text-muted">{metric.label}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Design Readiness">
        <ul className="space-y-2.5">
          {readiness.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-pass" />
              ) : (
                <Clock aria-hidden className="h-4 w-4 shrink-0 text-muted" />
              )}
              <span className={item.done ? 'font-semibold text-ink' : 'text-muted'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onReview} className={`${primaryButton} mt-5 w-full`}>
          Review &amp; Approve Design
        </button>
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------- requirements */

const REQUIREMENT_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];
const REQUIREMENT_PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const REQUIREMENT_SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'document', label: 'Document' },
  { value: 'jira', label: 'JIRA' },
];
const PRIORITY_FILTER = [{ value: 'all', label: 'Priority: All' }, ...REQUIREMENT_PRIORITY_OPTIONS];
const SOURCE_FILTER = [{ value: 'all', label: 'Source: All' }, ...REQUIREMENT_SOURCE_OPTIONS];
const STATUS_FILTER = [{ value: 'all', label: 'Status: All' }, ...REQUIREMENT_STATUS_OPTIONS];

function RequirementsTab({
  api,
  designId,
  designSource,
  onChange,
}: {
  api: DesignApi;
  designId: string;
  designSource: DesignSource;
  onChange: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [addPriority, setAddPriority] = useState<RequirementPriority>('medium');
  const [addSource, setAddSource] = useState<DesignSource>(designSource);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // search + filters
  const [search, setSearch] = useState('');
  const [fPriority, setFPriority] = useState('all');
  const [fSource, setFSource] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  // inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editStatus, setEditStatus] = useState<RequirementStatus>('draft');
  const [editPriority, setEditPriority] = useState<RequirementPriority>('medium');
  const [editSource, setEditSource] = useState<DesignSource>('manual');

  function startEdit(req: Requirement) {
    setEditingId(req.id);
    setEditTitle(req.title);
    setEditBody(req.description ?? '');
    setEditStatus(req.status);
    setEditPriority(req.priority);
    setEditSource(req.source);
  }

  const load = useCallback(() => {
    setLoading(true);
    api
      .listRequirements(designId)
      .then((data) => setItems(data.requirements))
      .catch((cause: unknown) =>
        toast.push(cause instanceof Error ? cause.message : 'Failed to load', 'error'),
      )
      .finally(() => setLoading(false));
  }, [api, designId, toast]);

  useEffect(load, [load]);

  async function guard(fn: () => Promise<void>) {
    try {
      await fn();
      load();
      onChange();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    }
  }

  function resetForm() {
    setAdding(false);
    setTitle('');
    setBody('');
    setAddPriority('medium');
    setAddSource(designSource);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = items.filter((req) => {
    if (fPriority !== 'all' && req.priority !== fPriority) return false;
    if (fSource !== 'all' && req.source !== fSource) return false;
    if (fStatus !== 'all' && req.status !== fStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${req.title} ${req.description ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <SectionCard
      title={<h3 className="text-base font-bold text-ink">Requirements</h3>}
      action={
        !adding ? (
          <div className="flex items-center gap-2">
            <ImportRequirementsButton
              api={api}
              designId={designId}
              onImported={() => {
                load();
                onChange();
              }}
            />
            <button type="button" onClick={() => setAdding(true)} className={primaryButton}>
              <Plus aria-hidden className="h-4 w-4" />
              Add Requirement
            </button>
          </div>
        ) : undefined
      }
    >
      {adding && (
        <form
          className="mb-5 flex flex-col gap-3 rounded-card border border-line bg-cream/50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            const payload = {
              title: title.trim(),
              description: body.trim() || undefined,
              priority: addPriority,
              source: addSource,
            };
            resetForm();
            void guard(() => api.createRequirement(designId, payload).then(() => undefined));
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            placeholder="Requirement title, e.g. User login"
            className={inputClasses}
          />
          <DescriptionEditor value={body} onChange={setBody} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Priority
              <span className="w-32">
                <Select
                  options={REQUIREMENT_PRIORITY_OPTIONS}
                  value={addPriority}
                  onChange={(value) => setAddPriority(value as RequirementPriority)}
                />
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Source
              <span className="w-32">
                <Select
                  options={REQUIREMENT_SOURCE_OPTIONS}
                  value={addSource}
                  onChange={(value) => setAddSource(value as DesignSource)}
                />
              </span>
            </label>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={resetForm} className={ghostButton}>
                Cancel
              </button>
              <button type="submit" className={primaryButton}>
                Add Requirement
              </button>
            </div>
          </div>
        </form>
      )}

      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex min-w-48 flex-1 items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2">
            <Search aria-hidden className="h-4 w-4 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
          <div className="w-36">
            <Select options={PRIORITY_FILTER} value={fPriority} onChange={setFPriority} />
          </div>
          <div className="w-36">
            <Select options={SOURCE_FILTER} value={fSource} onChange={setFSource} />
          </div>
          <div className="w-36">
            <Select options={STATUS_FILTER} value={fStatus} onChange={setFStatus} />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No requirements yet — add the first one.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">No requirements match these filters.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((req, index) => {
            const open = expanded.has(req.id);
            const hasBody = Boolean(req.description?.trim());

            if (editingId === req.id) {
              return (
                <li
                  key={req.id}
                  className="rounded-card border border-primary/40 bg-cream/50 p-4"
                >
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!editTitle.trim()) return;
                      const payload = {
                        title: editTitle.trim(),
                        description: editBody.trim() || null,
                        status: editStatus,
                        priority: editPriority,
                        source: editSource,
                      };
                      setEditingId(null);
                      void guard(() =>
                        api.updateRequirement(designId, req.id, payload).then(() => undefined),
                      );
                    }}
                  >
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      required
                      className={inputClasses}
                    />
                    <DescriptionEditor value={editBody} onChange={setEditBody} />
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                        Priority
                        <span className="w-32">
                          <Select
                            options={REQUIREMENT_PRIORITY_OPTIONS}
                            value={editPriority}
                            onChange={(value) => setEditPriority(value as RequirementPriority)}
                          />
                        </span>
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                        Source
                        <span className="w-32">
                          <Select
                            options={REQUIREMENT_SOURCE_OPTIONS}
                            value={editSource}
                            onChange={(value) => setEditSource(value as DesignSource)}
                          />
                        </span>
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                        Status
                        <span className="w-32">
                          <Select
                            options={REQUIREMENT_STATUS_OPTIONS}
                            value={editStatus}
                            onChange={(value) => setEditStatus(value as RequirementStatus)}
                          />
                        </span>
                      </label>
                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={ghostButton}
                        >
                          Cancel
                        </button>
                        <button type="submit" className={primaryButton}>
                          Save
                        </button>
                      </div>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li key={req.id} className="rounded-card border border-line bg-white">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => hasBody && toggle(req.id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
                      hasBody ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {hasBody ? (
                      <ChevronRight
                        aria-hidden
                        className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                          open ? 'rotate-90' : ''
                        }`}
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="font-mono text-xs font-semibold text-accent-deep">
                      REQ-{String(index + 1).padStart(3, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {req.title}
                    </span>
                  </button>
                  <PriorityBadge priority={req.priority} />
                  <SourceChip source={req.source} />
                  <RequirementStatusBadge status={req.status} />
                  <button
                    type="button"
                    aria-label="Edit requirement"
                    onClick={() => startEdit(req)}
                    className="text-muted transition-colors hover:text-primary-deep"
                  >
                    <Pencil aria-hidden className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete requirement"
                    onClick={() =>
                      void guard(() =>
                        api.deleteRequirement(designId, req.id).then(() => undefined),
                      )
                    }
                    className="text-muted transition-colors hover:text-fail"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </div>
                {open && hasBody && (
                  <div className="border-t border-line px-4 py-3 pl-10">
                    <Markdown source={req.description ?? ''} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ----------------------------------------------------------------- coverage */

function CoverageTab({ design }: { design: TestDesign }) {
  const { requirementCount, suiteCount, caseCount } = design;
  // a simple, honest signal until AI evidence coverage lands
  const covered = requirementCount > 0 && caseCount > 0;
  const ratio = requirementCount > 0 ? Math.min(100, Math.round((caseCount / requirementCount) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Cases per Requirement">
          <div className="flex flex-col items-center gap-2 py-2">
            <ProgressRing value={ratio} size={128} stroke={12} colorClass="text-pass" />
            <p className="text-xs text-muted">{caseCount} cases · {requirementCount} requirements</p>
          </div>
        </SectionCard>
        <SectionCard title="Artefact Counts" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { value: requirementCount, label: 'Requirements' },
              { value: suiteCount, label: 'Suites' },
              { value: caseCount, label: 'Cases' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[10px] bg-cream/60 py-5">
                <p className="text-2xl font-bold text-primary-deep">{metric.value}</p>
                <p className="mt-0.5 text-xs text-muted">{metric.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            {covered
              ? 'Every requirement should map to at least one case — use Traceability to check.'
              : 'Add requirements and generate test cases to build coverage.'}
          </p>
        </SectionCard>
      </div>
      <ComingSoon
        title="Evidence Coverage & Gaps"
        note="Dimension-level coverage (functional, negative, boundary, security…) and gap detection arrive with the AI phase."
      />
    </div>
  );
}

/* ------------------------------------------------------------- traceability */

function TraceabilityTab({ api, design }: { api: DesignApi; design: TestDesign }) {
  const toast = useToast();
  const [tree, setTree] = useState<{ plan: TestPlan; suites: { suite: TestSuite; cases: TestCase[] }[] }[]>(
    [],
  );
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [connected, setConnected] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      // connected integrations are optional — never fail traceability over them
      const [{ testPlans }, { requirements: reqs }, integrations] = await Promise.all([
        api.listPlans(design.id),
        api.listRequirements(design.id),
        api.listIntegrations().catch(() => ({ integrations: [] as IntegrationSummary[] })),
      ]);
      if (live) {
        setRequirements(reqs);
        setConnected(integrations.integrations.filter((i) => i.status === 'connected'));
      }
      const built = await Promise.all(
        testPlans.map(async (plan) => {
          const { testSuites } = await api.listSuites(plan.id);
          const suites = await Promise.all(
            testSuites.map(async (suite) => ({
              suite,
              cases: (await api.listCases(suite.id)).testCases,
            })),
          );
          return { plan, suites };
        }),
      );
      if (live) setTree(built);
    })()
      .catch((cause: unknown) =>
        toast.push(cause instanceof Error ? cause.message : 'Failed to load traceability', 'error'),
      )
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, design.id, toast]);

  return (
    <div className="space-y-5">
      <SectionCard title={<h3 className="text-base font-bold text-ink">Traceability</h3>}>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-muted">
            Generate test plans, suites and cases to see the traceability tree.
          </p>
        ) : (
          <ul className="space-y-4">
            {tree.map(({ plan, suites }) => (
              <li key={plan.id} className="rounded-card border border-line bg-cream/40 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <FileText aria-hidden className="h-4 w-4 text-accent" />
                  {plan.title}
                </p>
                {suites.length === 0 ? (
                  <p className="mt-2 pl-6 text-xs text-muted">No suites yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2 pl-6">
                    {suites.map(({ suite, cases }) => (
                      <li key={suite.id}>
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <Layers aria-hidden className="h-3.5 w-3.5 text-primary" />
                          {suite.title}
                        </p>
                        <ul className="mt-1 space-y-1.5 pl-5">
                          {cases.length === 0 ? (
                            <span className="text-xs text-muted">No cases</span>
                          ) : (
                            cases.map((testCase) => (
                              <li
                                key={testCase.id}
                                className="flex flex-wrap items-center gap-x-2 gap-y-1"
                              >
                                <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-ink">
                                  {testCase.title}
                                </span>
                                <EntityLinks
                                  api={api}
                                  entityType="test_case"
                                  entityId={testCase.id}
                                  connected={connected}
                                />
                              </li>
                            ))
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={<h3 className="text-base font-bold text-ink">Issue &amp; repository links</h3>}
      >
        {connected.length === 0 && (
          <p className="mb-3 rounded-[10px] bg-cream/60 px-3 py-2 text-xs text-muted">
            No integrations connected. Add JIRA, GitHub, Bitbucket or Notion under{' '}
            <span className="font-semibold text-ink">Profile → Integrations</span> to link
            requirements and test cases to external items.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : requirements.length === 0 ? (
          <p className="text-sm text-muted">Add requirements to link them to external items.</p>
        ) : (
          <ul className="divide-y divide-line">
            {requirements.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {req.title}
                </span>
                <EntityLinks
                  api={api}
                  entityType="requirement"
                  entityId={req.id}
                  connected={connected}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ approval */

function ApprovalTab({
  api,
  design,
  onChange,
}: {
  api: DesignApi;
  design: TestDesign;
  onChange: () => void;
}) {
  const toast = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .listDesignApprovals(design.id)
      .then((data) => setApprovals(data.approvals))
      .catch(() => undefined);
  }, [api, design.id]);

  useEffect(load, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChange();
      load();
      setComment('');
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  const readiness = [
    { label: 'Requirements captured', done: design.requirementCount > 0 },
    { label: 'Test suites built', done: design.suiteCount > 0 },
    { label: 'Test cases written', done: design.caseCount > 0 },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <SectionCard title="Readiness" className="lg:col-span-3">
        <ul className="divide-y divide-line">
          {readiness.map((item) => (
            <li key={item.label} className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {item.done ? (
                  <CheckCircle2 aria-hidden className="h-4 w-4 text-pass" />
                ) : (
                  <Clock aria-hidden className="h-4 w-4 text-muted" />
                )}
                {item.label}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  item.done ? 'bg-pass-tint text-pass' : 'bg-cream text-muted'
                }`}
              >
                {item.done ? 'Ready' : 'Pending'}
              </span>
            </li>
          ))}
        </ul>

        {approvals.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              Approval history
            </p>
            <ul className="space-y-1.5">
              {approvals.map((approval) => (
                <li key={approval.id} className="flex items-center gap-2 text-sm text-ink">
                  <span className="font-mono text-xs text-muted">v{approval.version}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                      approval.status === 'approved'
                        ? 'bg-pass-tint text-pass'
                        : approval.status === 'rejected'
                          ? 'bg-fail-tint text-fail'
                          : 'bg-warn-tint text-warn'
                    }`}
                  >
                    {approval.status}
                  </span>
                  {approval.comment && <span className="text-xs text-muted">{approval.comment}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Decision" className="lg:col-span-2">
        <p className="mb-3 flex items-center gap-2 text-sm">
          Status: <StatusBadge status={design.status} />
        </p>

        {design.status === 'draft' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(() => api.submitDesign(design.id))}
            className={`${primaryButton} w-full`}
          >
            Submit for Review
          </button>
        )}

        {design.status === 'in_review' && (
          <>
            <textarea
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Approval comment (optional)…"
              className={`${inputClasses} resize-y`}
            />
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() => api.decideDesign(design.id, 'approved', comment || undefined))
                }
                className={primaryButton}
              >
                Approve Design
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() => api.decideDesign(design.id, 'rejected', comment || undefined))
                }
                className={ghostButton}
              >
                Request Changes
              </button>
            </div>
          </>
        )}

        {design.status === 'approved' && (
          <p className="rounded-[10px] bg-pass-tint/60 px-3 py-2 text-sm text-pass">
            This design is approved. Editing it will start a new version for re-approval.
          </p>
        )}
        {design.status === 'archived' && (
          <p className="rounded-[10px] bg-fail-tint/60 px-3 py-2 text-sm text-fail">
            This design is archived.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

/* ----------------------------------------------------------------- artifacts */

type SuiteNode = { suite: TestSuite; cases: TestCase[] };
type PlanNode = { plan: TestPlan; suites: SuiteNode[] };
type ArtifactSub = 'plan' | 'suites' | 'cases';

type Guard = (fn: () => Promise<unknown>) => Promise<void>;
type AskDelete = (
  message: string,
  run: () => Promise<unknown>,
  opts?: { title?: string; confirmLabel?: string },
) => void;

function ArtifactsTab({
  api,
  design,
  designId,
  onChange,
}: {
  api: DesignApi;
  design: TestDesign;
  designId: string;
  onChange: () => void;
}) {
  const toast = useToast();
  const [tree, setTree] = useState<PlanNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<ArtifactSub>('plan');
  const [generating, setGenerating] = useState(false);
  const [pending, setPending] = useState<{
    title: string;
    confirmLabel: string;
    message: string;
    run: () => Promise<unknown>;
  } | null>(null);
  const approved = design.status === 'approved';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { testPlans } = await api.listPlans(designId);
      const nodes = await Promise.all(
        testPlans.map(async (plan) => {
          const { testSuites } = await api.listSuites(plan.id);
          const suites = await Promise.all(
            testSuites.map(async (suite) => ({
              suite,
              cases: (await api.listCases(suite.id)).testCases,
            })),
          );
          return { plan, suites };
        }),
      );
      setTree(nodes);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to load artifacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, designId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const guard: Guard = async (fn) => {
    try {
      await fn();
      await load();
      onChange();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Something went wrong', 'error');
    }
  };

  const askDelete: AskDelete = (message, run, opts) =>
    setPending({
      title: opts?.title ?? 'Delete',
      confirmLabel: opts?.confirmLabel ?? 'Delete',
      message,
      run,
    });

  async function generate() {
    setGenerating(true);
    try {
      const result = await api.generateArtifacts(designId);
      toast.push(
        `Generated a plan with ${result.suiteCount} suites and ${result.caseCount} cases`,
        'success',
      );
      await load();
      onChange();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  const suiteTotal = tree.reduce((n, p) => n + p.suites.length, 0);
  const caseTotal = tree.reduce(
    (n, p) => n + p.suites.reduce((m, s) => m + s.cases.length, 0),
    0,
  );
  const subs: { key: ArtifactSub; label: string; count: number }[] = [
    { key: 'plan', label: 'Test Plan', count: tree.length },
    { key: 'suites', label: 'Test Suites', count: suiteTotal },
    { key: 'cases', label: 'Test Cases', count: caseTotal },
  ];

  return (
    <SectionCard
      title={<h3 className="text-base font-bold text-ink">Test Artifacts</h3>}
      action={
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!approved || generating}
          title={
            approved
              ? 'Generate a plan, suites and cases from the requirements'
              : 'Approve the design first'
          }
          className={primaryButton}
        >
          <Sparkles aria-hidden className="h-4 w-4" />
          {generating ? 'Generating…' : 'Generate from requirements'}
        </button>
      }
    >
      {!approved && (
        <p className="mb-4 rounded-[10px] bg-warn-tint/50 px-3 py-2 text-sm text-ink">
          Approve the design (Approval tab) to generate test artifacts from its requirements.
        </p>
      )}

      <div className="mb-5 flex gap-2 rounded-card border border-line bg-white p-1.5">
        {subs.map((item) => {
          const active = sub === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSub(item.key)}
              className={`flex-1 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-accent text-white' : 'text-muted hover:bg-primary-tint/50 hover:text-ink'
              }`}
            >
              {item.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/25 text-white' : 'bg-cream text-muted'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : sub === 'plan' ? (
        <PlanSection
          api={api}
          designId={designId}
          nodes={tree}
          guard={guard}
          askDelete={askDelete}
        />
      ) : sub === 'suites' ? (
        <SuitesSection api={api} nodes={tree} guard={guard} askDelete={askDelete} />
      ) : (
        <CasesSection api={api} nodes={tree} guard={guard} askDelete={askDelete} />
      )}

      {pending && (
        <ConfirmModal
          title={pending.title}
          confirmLabel={pending.confirmLabel}
          message={pending.message}
          onConfirm={() => {
            const p = pending;
            setPending(null);
            void guard(p.run);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------- Test Plan tab */

function PlanSection({
  api,
  designId,
  nodes,
  guard,
  askDelete,
}: {
  api: DesignApi;
  designId: string;
  nodes: PlanNode[];
  guard: Guard;
  askDelete: AskDelete;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className={ghostButton}>
            <Plus aria-hidden className="h-4 w-4" />
            New Test Plan
          </button>
        )}
      </div>
      {creating && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            const value = title.trim();
            setTitle('');
            setCreating(false);
            void guard(() => api.createPlan(designId, { title: value }));
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            placeholder="Test plan title"
            className={inputClasses}
          />
          <button type="submit" className={primaryButton}>
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)} className={ghostButton}>
            Cancel
          </button>
        </form>
      )}

      {nodes.length === 0 ? (
        <p className="text-sm text-muted">
          No test plans yet — generate from requirements or create one.
        </p>
      ) : (
        nodes.map((node) => (
          <PlanCard key={node.plan.id} api={api} node={node} guard={guard} askDelete={askDelete} />
        ))
      )}
    </div>
  );
}

function PlanCard({
  api,
  node,
  guard,
  askDelete,
}: {
  api: DesignApi;
  node: PlanNode;
  guard: Guard;
  askDelete: AskDelete;
}) {
  const { plan } = node;
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(plan.title);
  const [editingDetails, setEditingDetails] = useState(false);
  const [objDraft, setObjDraft] = useState('');
  const [scopeDraft, setScopeDraft] = useState('');
  const [stratDraft, setStratDraft] = useState('');

  const suiteN = node.suites.length;
  const caseN = node.suites.reduce((m, s) => m + s.cases.length, 0);

  function startRename() {
    setTitleDraft(plan.title);
    setRenaming(true);
  }
  function startEditDetails() {
    setObjDraft(plan.objective ?? '');
    setScopeDraft(plan.scope.join(', '));
    setStratDraft(plan.strategy ?? '');
    setEditingDetails(true);
  }

  const iconButton = 'text-muted transition-colors hover:text-primary-deep';

  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const next = titleDraft.trim();
              setRenaming(false);
              if (next && next !== plan.title) void guard(() => api.updatePlan(plan.id, { title: next }));
            }}
          >
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              className={inputClasses}
            />
            <button type="submit" className={primaryButton}>
              Save
            </button>
            <button type="button" onClick={() => setRenaming(false)} className={ghostButton}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h4 className="text-sm font-bold text-ink">{plan.title}</h4>
            <StatusBadge status={plan.status} />
            <span className="text-xs text-muted">v{plan.version}</span>
            <span className="ml-auto flex items-center gap-2">
              {plan.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => void guard(() => api.submitPlan(plan.id))}
                  className={ghostButton}
                >
                  Submit
                </button>
              )}
              {plan.status === 'in_review' && (
                <button
                  type="button"
                  onClick={() => void guard(() => api.decidePlan(plan.id, 'approved'))}
                  className={ghostButton}
                >
                  Approve
                </button>
              )}
              <button type="button" aria-label="Rename plan" onClick={startRename} className={iconButton}>
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Archive plan"
                onClick={() =>
                  askDelete(
                    `Archive test plan "${plan.title}"? Its suites and cases are preserved.`,
                    () => api.archivePlan(plan.id),
                    { title: 'Archive test plan', confirmLabel: 'Archive' },
                  )
                }
                className="text-muted transition-colors hover:text-fail"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </span>
          </>
        )}
      </div>

      <div className="mt-3 rounded-[10px] border border-line bg-cream/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Plan details</p>
          {!editingDetails && (
            <button
              type="button"
              onClick={startEditDetails}
              className="text-sm font-semibold text-accent hover:text-accent-deep"
            >
              Edit details
            </button>
          )}
        </div>
        {editingDetails ? (
          <div className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
              Objective
              <textarea
                rows={2}
                value={objDraft}
                onChange={(event) => setObjDraft(event.target.value)}
                className={`${inputClasses} resize-y font-normal normal-case`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
              Scope (comma-separated)
              <input
                value={scopeDraft}
                onChange={(event) => setScopeDraft(event.target.value)}
                placeholder="Login, Cart, Checkout"
                className={`${inputClasses} font-normal normal-case`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
              Strategy
              <input
                value={stratDraft}
                onChange={(event) => setStratDraft(event.target.value)}
                placeholder="Functional + Negative + Boundary"
                className={`${inputClasses} font-normal normal-case`}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingDetails(false)} className={ghostButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const scope = scopeDraft
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setEditingDetails(false);
                  void guard(() =>
                    api.updatePlan(plan.id, {
                      objective: objDraft.trim() || null,
                      scope,
                      strategy: stratDraft.trim() || null,
                    }),
                  );
                }}
                className={primaryButton}
              >
                Save details
              </button>
            </div>
          </div>
        ) : (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Objective</dt>
              <dd className="text-ink">{plan.objective || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Scope</dt>
              <dd>
                {plan.scope.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {plan.scope.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-semibold text-ink"
                      >
                        {item}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-ink">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Strategy</dt>
              <dd className="text-ink">{plan.strategy || '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        {suiteN} suite{suiteN === 1 ? '' : 's'} · {caseN} case{caseN === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- Test Suites tab */

function SuitesSection({
  api,
  nodes,
  guard,
  askDelete,
}: {
  api: DesignApi;
  nodes: PlanNode[];
  guard: Guard;
  askDelete: AskDelete;
}) {
  const [adding, setAdding] = useState(false);
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');

  const planOptions = nodes.map((n) => ({ value: n.plan.id, label: n.plan.title }));
  const suites = nodes.flatMap((n) =>
    n.suites.map((s) => ({ suite: s.suite, caseCount: s.cases.length, planTitle: n.plan.title })),
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {!adding && nodes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPlanId(nodes[0]!.plan.id);
              setTitle('');
              setAdding(true);
            }}
            className={ghostButton}
          >
            <Plus aria-hidden className="h-4 w-4" />
            Add Suite
          </button>
        )}
      </div>
      {adding && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-cream/50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || !planId) return;
            const value = title.trim();
            setAdding(false);
            setTitle('');
            void guard(() => api.createSuite(planId, { title: value }));
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            Plan
            <span className="w-48">
              <Select options={planOptions} value={planId} onChange={setPlanId} />
            </span>
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            placeholder="Suite title"
            className={inputClasses}
          />
          <button type="submit" className={primaryButton}>
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className={ghostButton}>
            Cancel
          </button>
        </form>
      )}

      {nodes.length === 0 ? (
        <p className="text-sm text-muted">Create a test plan first.</p>
      ) : suites.length === 0 ? (
        <p className="text-sm text-muted">No suites yet.</p>
      ) : (
        <div className="space-y-2">
          {suites.map(({ suite, caseCount, planTitle }) => (
            <SuiteItem
              key={suite.id}
              api={api}
              suite={suite}
              planTitle={planTitle}
              caseCount={caseCount}
              guard={guard}
              askDelete={askDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuiteItem({
  api,
  suite,
  planTitle,
  caseCount,
  guard,
  askDelete,
}: {
  api: DesignApi;
  suite: TestSuite;
  planTitle: string;
  caseCount: number;
  guard: Guard;
  askDelete: AskDelete;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(suite.title);

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-line bg-white px-4 py-2.5">
      <Layers aria-hidden className="h-4 w-4 shrink-0 text-primary" />
      {renaming ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = draft.trim();
            setRenaming(false);
            if (next && next !== suite.title) void guard(() => api.updateSuite(suite.id, { title: next }));
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={inputClasses}
          />
          <button type="submit" className={primaryButton}>
            Save
          </button>
          <button type="button" onClick={() => setRenaming(false)} className={ghostButton}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            {suite.title}
          </span>
          <span className="hidden text-xs text-muted sm:inline">in {planTitle}</span>
          <span className="shrink-0 text-xs font-semibold text-muted">{caseCount} cases</span>
          <button
            type="button"
            aria-label="Rename suite"
            onClick={() => {
              setDraft(suite.title);
              setRenaming(true);
            }}
            className="text-muted transition-colors hover:text-primary-deep"
          >
            <Pencil aria-hidden className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete suite"
            onClick={() =>
              askDelete(`Delete suite "${suite.title}" and all its cases? This cannot be undone.`, () =>
                api.deleteSuite(suite.id),
              )
            }
            className="text-muted transition-colors hover:text-fail"
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Test Cases tab */

function CasesSection({
  api,
  nodes,
  guard,
  askDelete,
}: {
  api: DesignApi;
  nodes: PlanNode[];
  guard: Guard;
  askDelete: AskDelete;
}) {
  const [adding, setAdding] = useState(false);
  const [suiteId, setSuiteId] = useState('');
  const [title, setTitle] = useState('');

  const suiteOptions = nodes.flatMap((n) =>
    n.suites.map((s) => ({ value: s.suite.id, label: `${n.plan.title} / ${s.suite.title}` })),
  );
  const cases = nodes.flatMap((n) =>
    n.suites.flatMap((s) => s.cases.map((c) => ({ testCase: c, suiteTitle: s.suite.title }))),
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {!adding && suiteOptions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSuiteId(suiteOptions[0]!.value);
              setTitle('');
              setAdding(true);
            }}
            className={ghostButton}
          >
            <Plus aria-hidden className="h-4 w-4" />
            Add Case
          </button>
        )}
      </div>
      {adding && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-cream/50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || !suiteId) return;
            const value = title.trim();
            setAdding(false);
            setTitle('');
            void guard(() => api.createCase(suiteId, { title: value }));
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            Suite
            <span className="w-60">
              <Select options={suiteOptions} value={suiteId} onChange={setSuiteId} />
            </span>
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            placeholder="Case title"
            className={inputClasses}
          />
          <button type="submit" className={primaryButton}>
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className={ghostButton}>
            Cancel
          </button>
        </form>
      )}

      {suiteOptions.length === 0 ? (
        <p className="text-sm text-muted">Create a suite first.</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-muted">No cases yet.</p>
      ) : (
        <div className="space-y-2">
          {cases.map(({ testCase, suiteTitle }) => (
            <CaseItem
              key={testCase.id}
              api={api}
              testCase={testCase}
              suiteTitle={suiteTitle}
              guard={guard}
              askDelete={askDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseItem({
  api,
  testCase,
  suiteTitle,
  guard,
  askDelete,
}: {
  api: DesignApi;
  testCase: TestCase;
  suiteTitle: string;
  guard: Guard;
  askDelete: AskDelete;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(testCase.title);
  const hasSteps = testCase.steps.length > 0;

  return (
    <div className="rounded-[10px] border border-line bg-white">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const next = draft.trim();
              setRenaming(false);
              if (next && next !== testCase.title)
                void guard(() => api.updateCase(testCase.id, { title: next }));
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className={inputClasses}
            />
            <button type="submit" className={primaryButton}>
              Save
            </button>
            <button type="button" onClick={() => setRenaming(false)} className={ghostButton}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => hasSteps && setOpen(!open)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
                hasSteps ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {hasSteps ? (
                <ChevronRight
                  aria-hidden
                  className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${
                    open ? 'rotate-90' : ''
                  }`}
                />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{testCase.title}</span>
            </button>
            <span className="hidden text-xs text-muted sm:inline">in {suiteTitle}</span>
            <PriorityBadge priority={testCase.priority} />
            <button
              type="button"
              aria-label="Rename case"
              onClick={() => {
                setDraft(testCase.title);
                setRenaming(true);
              }}
              className="text-muted transition-colors hover:text-primary-deep"
            >
              <Pencil aria-hidden className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete case"
              onClick={() =>
                askDelete(`Delete case "${testCase.title}"? This cannot be undone.`, () =>
                  api.deleteCase(testCase.id),
                )
              }
              className="text-muted transition-colors hover:text-fail"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      {open && hasSteps && (
        <div className="border-t border-line px-4 py-3 pl-10">
          <ol className="space-y-2">
            {testCase.steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-bold text-primary-deep">
                  {index + 1}
                </span>
                <span className="text-ink">
                  {step.action}
                  {step.expected ? (
                    <span className="mt-0.5 block text-xs text-muted">Expected: {step.expected}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- coming soon */

function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent-deep">
          <Sparkles aria-hidden className="h-6 w-6" />
        </span>
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="max-w-md text-sm text-muted">{note}</p>
        <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-deep">
          Coming soon
        </span>
      </div>
    </SectionCard>
  );
}
