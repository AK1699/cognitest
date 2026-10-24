'use client';

import {
  FileDown,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '../../toast';
import { useActiveProject } from '../use-active-project';
import { Select } from '../select';
import { designApi, type DesignApi, type TestDesign } from './api';
import { ConfirmModal } from './confirm-modal';
import { SourceChip, StatusBadge, primaryButton } from './design-ui';
import { exportDesignExcel, exportDesignPdf, gatherDesignExport } from './export-design';

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Status: All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Source: All' },
  { value: 'manual', label: 'Manual' },
  { value: 'document', label: 'Document' },
  { value: 'jira', label: 'JIRA' },
];

export function DesignLanding({
  organizationId,
  projects,
}: {
  organizationId: string;
  projects: Project[];
}) {
  const toast = useToast();
  const [activeProject] = useActiveProject(organizationId, projects);
  const projectId = activeProject?.id ?? null;

  const [designs, setDesigns] = useState<TestDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    designApi(organizationId, projectId)
      .listDesigns()
      .then((data) => {
        if (live) setDesigns(data.designs);
      })
      .catch((cause: unknown) => {
        if (live) toast.push(cause instanceof Error ? cause.message : 'Failed to load designs', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organizationId, projectId, toast]);

  const api = projectId ? designApi(organizationId, projectId) : null;

  const visible = designs.filter((design) => {
    if (status !== 'all' && design.status !== status) return false;
    if (source !== 'all' && design.source !== source) return false;
    return true;
  });

  const newHref = projectId
    ? `/${organizationId}/design/new?project=${projectId}`
    : `/${organizationId}/design/new`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-deep">Design</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Capture requirements, analyse coverage and generate reviewable test artifacts — one
            test design at a time.
          </p>
        </div>
        {projectId && (
          <Link href={newHref} className={primaryButton}>
            <Plus aria-hidden className="h-4 w-4" />
            New Test Design
          </Link>
        )}
      </div>

      {!projectId || !api ? (
        <p className="rounded-card border border-dashed border-line bg-white p-8 text-sm text-muted">
          No projects yet — create one in the Projects section to start designing tests.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </div>
            <div className="w-40">
              <Select options={SOURCE_OPTIONS} value={source} onChange={setSource} />
            </div>
          </div>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Test Designs {activeProject && <span className="text-muted/70">· {activeProject.name}</span>}
          </h2>

          {loading ? (
            <p className="rounded-card border border-line bg-white p-10 text-center text-sm text-muted">
              Loading…
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
              {designs.length === 0
                ? 'No test designs yet — create your first one.'
                : 'No test designs match these filters.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((design) => (
                <DesignCard
                  key={design.id}
                  api={api}
                  design={design}
                  organizationId={organizationId}
                  projectId={projectId}
                  projectName={activeProject?.name}
                  onDeleted={(id) => setDesigns((prev) => prev.filter((d) => d.id !== id))}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function DesignCard({
  api,
  design,
  organizationId,
  projectId,
  projectName,
  onDeleted,
}: {
  api: DesignApi;
  design: TestDesign;
  organizationId: string;
  projectId: string;
  projectName?: string;
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

  async function runExport(kind: 'pdf' | 'excel') {
    setMenuOpen(false);
    try {
      const data = await gatherDesignExport(api, design.id);
      if (kind === 'pdf') {
        if (!exportDesignPdf(design, data, projectName)) {
          toast.push('Allow pop-ups to export as PDF', 'error');
        }
      } else {
        exportDesignExcel(design, data, projectName);
      }
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Export failed', 'error');
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await api.deleteDesign(design.id);
      toast.push('Design deleted', 'success');
      onDeleted(design.id);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to delete', 'error');
    }
  }

  const menuItem =
    'flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold transition-colors';

  return (
    <li className="relative flex items-center gap-4 rounded-card border border-line bg-white p-5 transition-colors hover:border-primary/50 hover:bg-primary-tint/30">
      <Link
        href={`/${organizationId}/design/${design.id}?project=${projectId}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent-deep">
          <FileText aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{design.name}</h3>
            <SourceChip source={design.source} />
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {design.requirementCount} Req
            <span className="mx-1.5 text-line">·</span>
            {design.suiteCount} Suites
            <span className="mx-1.5 text-line">·</span>
            {design.caseCount} Cases
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={design.status} />
        <span className="text-xs text-muted">v{design.version}</span>
      </div>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Design actions"
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
            <button
              type="button"
              role="menuitem"
              onClick={() => void runExport('pdf')}
              className={`${menuItem} text-ink hover:bg-primary-tint/60`}
            >
              <FileDown aria-hidden className="h-4 w-4 text-muted" />
              Export as PDF
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void runExport('excel')}
              className={`${menuItem} text-ink hover:bg-primary-tint/60`}
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
                setConfirmDelete(true);
              }}
              className={`${menuItem} text-fail hover:bg-fail-tint/50`}
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete design
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete design"
          message={`Permanently delete "${design.name}"? This also removes its requirements, plans, suites and cases. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </li>
  );
}
