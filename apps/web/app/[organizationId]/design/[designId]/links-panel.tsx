'use client';

import { DownloadCloud, ExternalLink, Link2, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ExternalLinkEntityType, IntegrationProvider } from '@cognitest/shared';

import { Modal } from '../../modal';
import { useToast } from '../../../toast';
import type { DesignApi, ExternalLinkView, IntegrationSummary, SearchHit } from '../api';
import { ghostButton } from '../design-ui';

const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  jira: 'JIRA',
  github: 'GitHub',
  bitbucket: 'Bitbucket',
  notion: 'Notion',
};

/** Button + modal to import external items into a design as requirements. */
export function ImportRequirementsButton({
  api,
  designId,
  onImported,
}: {
  api: DesignApi;
  designId: string;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ghostButton}>
        <DownloadCloud aria-hidden className="h-4 w-4" />
        Import
      </button>
      {open && <ImportModal api={api} designId={designId} onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}

function ImportModal({
  api,
  designId,
  onClose,
  onImported,
}: {
  api: DesignApi;
  designId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const [connected, setConnected] = useState<IntegrationSummary[] | null>(null);
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<Map<string, SearchHit>>(new Map());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api
      .listIntegrations()
      .then((data) => {
        const usable = data.integrations.filter((i) => i.status === 'connected');
        setConnected(usable);
        setProvider(usable[0]?.provider ?? null);
      })
      .catch(() => setConnected([]));
  }, [api]);

  async function run() {
    if (!provider || !query.trim()) return;
    setSearching(true);
    try {
      const { results: hits } = await api.searchIntegration(provider, query.trim());
      setResults(hits);
      if (hits.length === 0) toast.push('No matches', 'info');
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  }

  function toggle(hit: SearchHit) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(hit.key)) next.delete(hit.key);
      else next.set(hit.key, hit);
      return next;
    });
  }

  async function doImport() {
    if (!provider || selected.size === 0) return;
    setImporting(true);
    try {
      const { imported } = await api.importRequirements({
        provider,
        designId,
        keys: [...selected.keys()],
      });
      toast.push(`Imported ${imported} requirement${imported === 1 ? '' : 's'}`, 'success');
      onImported();
      onClose();
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Import requirements" onClose={onClose}>
      {connected === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : connected.length === 0 ? (
        <p className="text-sm text-muted">
          No integrations are connected. Connect one under Profile → Integrations first.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={provider ?? ''}
              onChange={(event) => {
                setProvider(event.target.value as IntegrationProvider);
                setResults([]);
                setSelected(new Map());
              }}
              className="rounded-[10px] border border-line bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {connected.map((c) => (
                <option key={c.provider} value={c.provider}>
                  {PROVIDER_LABEL[c.provider]}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void run();
              }}
              placeholder="Search items to import…"
              className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button
              type="button"
              onClick={() => void run()}
              disabled={searching || !query.trim()}
              className="inline-flex items-center gap-1 rounded-[10px] bg-accent px-3 py-2 text-sm font-bold text-white hover:bg-accent-deep disabled:opacity-60"
            >
              <Search aria-hidden className="h-4 w-4" />
              {searching ? '…' : 'Search'}
            </button>
          </div>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {results.map((hit) => (
              <li key={hit.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-sm hover:border-primary">
                  <input
                    type="checkbox"
                    checked={selected.has(hit.key)}
                    onChange={() => toggle(hit)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{hit.title}</span>
                    <span className="block truncate text-xs text-muted">{hit.key}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => void doImport()}
              disabled={importing || selected.size === 0}
              className="rounded-[10px] bg-accent px-3.5 py-2 text-sm font-bold text-white hover:bg-accent-deep disabled:opacity-60"
            >
              {importing ? 'Importing…' : `Import ${selected.size || ''}`.trim()}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Inline links for one entity: chips + add/sync/remove. Loads on mount. */
export function EntityLinks({
  api,
  entityType,
  entityId,
  connected,
}: {
  api: DesignApi;
  entityType: ExternalLinkEntityType;
  entityId: string;
  connected: IntegrationSummary[];
}) {
  const toast = useToast();
  const [links, setLinks] = useState<ExternalLinkView[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .listLinks(entityType, entityId)
      .then((data) => {
        if (live) setLinks(data.links);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [api, entityType, entityId]);

  async function sync(linkId: string) {
    setBusy(linkId);
    try {
      const { link } = await api.syncLink(linkId);
      setLinks((prev) => prev.map((l) => (l.id === link.id ? link : l)));
      toast.push('Link refreshed', 'success');
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Sync failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(linkId: string) {
    setBusy(linkId);
    try {
      await api.deleteLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not remove link', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {links.map((link) => (
        <span
          key={link.id}
          className="group inline-flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-2 pr-1 text-[11px] text-ink"
        >
          <a
            href={link.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary-deep hover:underline"
            title={link.title ?? link.externalKey}
          >
            <ExternalLink aria-hidden className="h-3 w-3" />
            {link.externalKey}
          </a>
          {link.state && (
            <span className="rounded-full bg-primary-tint px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary-deep">
              {link.state}
            </span>
          )}
          <button
            type="button"
            onClick={() => void sync(link.id)}
            disabled={busy === link.id}
            title="Refresh status"
            className="rounded-full p-0.5 text-muted hover:bg-primary-tint hover:text-primary-deep disabled:opacity-50"
          >
            <RefreshCw aria-hidden className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => void remove(link.id)}
            disabled={busy === link.id}
            title="Remove link"
            className="rounded-full p-0.5 text-muted hover:bg-fail-tint hover:text-fail disabled:opacity-50"
          >
            <X aria-hidden className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-semibold text-muted hover:border-primary hover:text-primary-deep"
      >
        <Link2 aria-hidden className="h-3 w-3" />
        Link
      </button>
      {picking && (
        <LinkPicker
          api={api}
          connected={connected}
          onClose={() => setPicking(false)}
          onPicked={(link) => {
            setLinks((prev) => [link, ...prev.filter((l) => l.id !== link.id)]);
            setPicking(false);
          }}
          onLink={(hit, provider) =>
            api
              .createLink({
                provider,
                entityType,
                entityId,
                externalKey: hit.key,
                externalUrl: hit.url,
                title: hit.title,
                state: hit.state ?? undefined,
              })
              .then((data) => data.link)
          }
        />
      )}
    </div>
  );
}

/** Modal to pick a provider, search its items, and link one. */
function LinkPicker({
  api,
  connected,
  onClose,
  onPicked,
  onLink,
}: {
  api: DesignApi;
  connected: IntegrationSummary[];
  onClose: () => void;
  onPicked: (link: ExternalLinkView) => void;
  onLink: (hit: SearchHit, provider: IntegrationProvider) => Promise<ExternalLinkView>;
}) {
  const toast = useToast();
  const usable = connected.filter((c) => c.status === 'connected');
  const [provider, setProvider] = useState<IntegrationProvider | null>(usable[0]?.provider ?? null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  async function run() {
    if (!provider || !query.trim()) return;
    setSearching(true);
    try {
      const { results: hits } = await api.searchIntegration(provider, query.trim());
      setResults(hits);
      if (hits.length === 0) toast.push('No matches', 'info');
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  }

  async function pick(hit: SearchHit) {
    if (!provider) return;
    setLinking(hit.key);
    try {
      const link = await onLink(hit, provider);
      toast.push('Linked', 'success');
      onPicked(link);
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not link', 'error');
    } finally {
      setLinking(null);
    }
  }

  return (
    <Modal title="Link an external item" onClose={onClose}>
      {usable.length === 0 ? (
        <p className="text-sm text-muted">
          No integrations are connected yet. Connect one under Profile → Integrations, then come
          back here.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={provider ?? ''}
              onChange={(event) => {
                setProvider(event.target.value as IntegrationProvider);
                setResults([]);
              }}
              className="rounded-[10px] border border-line bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {usable.map((c) => (
                <option key={c.provider} value={c.provider}>
                  {PROVIDER_LABEL[c.provider]}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void run();
              }}
              placeholder={provider === 'notion' ? 'Search pages…' : 'Search by key or text…'}
              className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button
              type="button"
              onClick={() => void run()}
              disabled={searching || !query.trim()}
              className="inline-flex items-center gap-1 rounded-[10px] bg-accent px-3 py-2 text-sm font-bold text-white hover:bg-accent-deep disabled:opacity-60"
            >
              <Search aria-hidden className="h-4 w-4" />
              {searching ? '…' : 'Search'}
            </button>
          </div>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {results.map((hit) => (
              <li key={hit.key}>
                <button
                  type="button"
                  onClick={() => void pick(hit)}
                  disabled={linking !== null}
                  className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-line bg-white px-3 py-2 text-left text-sm hover:border-primary disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{hit.title}</span>
                    <span className="block truncate text-xs text-muted">{hit.key}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-primary-deep">
                    {linking === hit.key ? 'Linking…' : 'Link'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
