'use client';

import { ChevronRight, Loader2, Play, Square, Terminal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Modal } from '../../modal';
import { Select } from '../../select';
import { useToast } from '../../../toast';
import type { Automation, AutomationApi, AutomationRun, RunBody } from '../api';
import {
  RunStatusBadge,
  SectionCard,
  StatTile,
  TestStatusTag,
  formatDuration,
  ghostButton,
  inputClasses,
  primaryButton,
  timeAgo,
} from '../automation-ui';
import { Toggle } from '../toggle';

const ENV_OPTIONS = [
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
  { value: 'development', label: 'Development' },
];
const BROWSER_OPTIONS = [
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'webkit', label: 'WebKit' },
];

export function RunsPanel({
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
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [streaming, setStreaming] = useState<{ runId: string; logs: string[] } | null>(null);

  const load = useCallback(async () => {
    const { runs: fresh } = await api.listRuns(automationId);
    setRuns(fresh);
    return fresh;
  }, [api, automationId]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .listRuns(automationId)
      .then(({ runs: fresh }) => {
        if (live) setRuns(fresh);
      })
      .catch((cause: unknown) => {
        if (live) toast.push(cause instanceof Error ? cause.message : 'Failed to load runs', 'error');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, automationId, toast]);

  async function run(body: RunBody) {
    try {
      const { run: created } = await api.run(automationId, body);
      setShowConfig(false);
      await load();
      await onChange();
      // play the captured log back as a live console, then open the results
      setStreaming({ runId: created.id, logs: created.logs });
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Failed to run', 'error');
    }
  }

  if (streaming) {
    return (
      <RunningConsole
        logs={streaming.logs}
        onDone={() => {
          const runId = streaming.runId;
          setStreaming(null);
          setSelectedId(runId);
        }}
      />
    );
  }

  const selected = runs.find((r) => r.id === selectedId) ?? null;
  if (selected) {
    return <RunResults run={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          {runs.length} run{runs.length === 1 ? '' : 's'}
        </h2>
        <button type="button" onClick={() => setShowConfig(true)} className={primaryButton}>
          <Play aria-hidden className="h-4 w-4" />
          New Run
        </button>
      </div>

      {loading ? (
        <p className="rounded-card border border-line bg-white p-10 text-center text-sm text-muted">
          Loading…
        </p>
      ) : runs.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-white p-10 text-center">
          <Play aria-hidden className="mx-auto h-8 w-8 text-muted/60" />
          <p className="mt-3 text-sm text-muted">No runs yet — configure and start your first run.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {runs.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-primary-tint/30"
              >
                <RunStatusBadge status={r.status} />
                <span className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold text-pass">{r.passed} passed</span>
                  {r.failed > 0 && <span className="ml-2 font-semibold text-fail">{r.failed} failed</span>}
                  <span className="ml-2 text-muted">of {r.total}</span>
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  {r.environment ?? '—'} · {r.browser ?? '—'}
                </span>
                <span className="text-xs text-muted">{formatDuration(r.durationMs)}</span>
                <span className="hidden text-xs text-muted/70 md:inline">{timeAgo(r.createdAt)}</span>
                <ChevronRight aria-hidden className="h-4 w-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showConfig && (
        <RunConfigModal
          defaultBrowser={automation.config.defaultBrowser ?? 'chromium'}
          envOptions={
            automation.config.environments && automation.config.environments.length > 0
              ? automation.config.environments.map((env) => ({ value: env.name, label: env.name }))
              : ENV_OPTIONS
          }
          onClose={() => setShowConfig(false)}
          onRun={run}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- run config */

function RunConfigModal({
  defaultBrowser,
  envOptions,
  onClose,
  onRun,
}: {
  defaultBrowser: string;
  envOptions: { value: string; label: string }[];
  onClose: () => void;
  onRun: (body: RunBody) => Promise<void>;
}) {
  const [mode, setMode] = useState<'run' | 'debug'>('run');
  const [environment, setEnvironment] = useState(envOptions[0]?.value ?? 'staging');
  const [browser, setBrowser] = useState(defaultBrowser);
  const [workers, setWorkers] = useState('4');
  const [headless, setHeadless] = useState(true);
  const [captureScreenshots, setCaptureScreenshots] = useState(true);
  const [captureVideo, setCaptureVideo] = useState(false);
  const [traceExecution, setTraceExecution] = useState(false);
  const [running, setRunning] = useState(false);

  async function start() {
    setRunning(true);
    await onRun({
      environment,
      browser,
      workers: Number(workers) || 1,
      headless: mode === 'debug' ? false : headless,
      captureScreenshots,
      captureVideo,
      traceExecution: mode === 'debug' ? true : traceExecution,
    });
    setRunning(false);
  }

  return (
    <Modal title="Run Automation" onClose={onClose}>
      <div className="mb-4 inline-flex rounded-[10px] border border-line p-0.5">
        {(['run', 'debug'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-[8px] px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
              mode === m ? 'bg-accent text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Environment
          <Select options={envOptions} value={environment} onChange={setEnvironment} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Browser
          <Select options={BROWSER_OPTIONS} value={browser} onChange={setBrowser} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Workers
          <input
            type="number"
            min={1}
            max={64}
            value={workers}
            onChange={(event) => setWorkers(event.target.value)}
            className={inputClasses}
          />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <Toggle
          checked={mode === 'debug' ? false : headless}
          onChange={setHeadless}
          disabled={mode === 'debug'}
          label="Headless"
          hint={mode === 'debug' ? 'Debug runs always show the browser' : 'Run without a visible browser window'}
        />
        <Toggle
          checked={captureScreenshots}
          onChange={setCaptureScreenshots}
          label="Capture screenshots"
        />
        <Toggle checked={captureVideo} onChange={setCaptureVideo} label="Capture video" />
        <Toggle
          checked={mode === 'debug' ? true : traceExecution}
          onChange={setTraceExecution}
          disabled={mode === 'debug'}
          label="Trace execution"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>
          Cancel
        </button>
        <button type="button" disabled={running} onClick={start} className={primaryButton}>
          <Play aria-hidden className="h-4 w-4" />
          {running ? 'Running…' : mode === 'debug' ? 'Start Debug' : 'Run'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- live console */

/**
 * Plays a completed run's captured log back line-by-line so the run reads as
 * live. Real streaming arrives with the execution runtime; this keeps the
 * Run Automation screen faithful to the design in the meantime.
 */
function RunningConsole({ logs, onDone }: { logs: string[]; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const done = shown >= logs.length;

  useEffect(() => {
    if (done) {
      const timer = setTimeout(onDone, 700);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setShown((n) => n + 1), 450);
    return () => clearTimeout(timer);
  }, [shown, done, onDone]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {done ? (
            <Terminal aria-hidden className="h-4 w-4 text-pass" />
          ) : (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin text-accent" />
          )}
          <span className="text-sm font-bold text-ink">
            {done ? 'Run complete' : 'Running automation…'}
          </span>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-primary-tint"
        >
          <Square aria-hidden className="h-3.5 w-3.5" />
          {done ? 'View results' : 'Skip'}
        </button>
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-card border border-line bg-ink p-4">
        <pre className="font-mono text-xs leading-relaxed text-cream">
          {logs.slice(0, shown).join('\n')}
          {!done && <span className="animate-pulse"> ▋</span>}
        </pre>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- run results */

type ResultTab = 'results' | 'logs' | 'screenshots' | 'trace';

const RESULT_TABS: { key: ResultTab; label: string }[] = [
  { key: 'results', label: 'Test Results' },
  { key: 'logs', label: 'Logs' },
  { key: 'screenshots', label: 'Screenshots' },
  { key: 'trace', label: 'Trace' },
];

function RunResults({ run, onBack }: { run: AutomationRun; onBack: () => void }) {
  const [tab, setTab] = useState<ResultTab>('results');

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <button type="button" onClick={onBack} className="hover:text-primary-deep">
          Runs
        </button>
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        <span className="font-semibold text-ink">Run results</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RunStatusBadge status={run.status} />
          <span className="text-sm text-muted">
            {run.environment ?? '—'} · {run.browser ?? '—'} · {run.workers} worker
            {run.workers === 1 ? '' : 's'} · {timeAgo(run.createdAt)}
          </span>
        </div>
        <span className="text-sm font-semibold text-ink">{formatDuration(run.durationMs)}</span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value={run.total} label="Total Tests" accent="ink" />
        <StatTile value={run.passed} label="Passed" accent="pass" />
        <StatTile value={run.failed} label="Failed" accent="fail" />
        <StatTile value={run.skipped} label="Skipped" accent="primary" />
      </div>

      <div className="mb-6 border-b border-line">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {RESULT_TABS.map((item) => {
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

      {tab === 'results' && (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {run.results.map((result, index) => (
            <li key={index} className="flex items-center gap-4 px-5 py-3">
              <span className="w-6 text-center text-xs font-bold text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {result.name}
              </span>
              <span className="text-xs text-muted">{formatDuration(result.durationMs)}</span>
              <TestStatusTag status={result.status} />
            </li>
          ))}
        </ul>
      )}

      {tab === 'logs' && (
        <div className="overflow-x-auto rounded-card border border-line bg-ink p-4">
          <pre className="font-mono text-xs leading-relaxed text-cream">
            {run.logs.length ? run.logs.join('\n') : 'No logs captured.'}
          </pre>
        </div>
      )}

      {tab === 'screenshots' && (
        <SectionCard title="Screenshots">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Terminal aria-hidden className="h-4 w-4" />
            {run.captureScreenshots
              ? 'Screenshot capture was enabled — artefacts are stored by the execution runtime (later phase).'
              : 'Screenshot capture was disabled for this run.'}
          </div>
        </SectionCard>
      )}

      {tab === 'trace' && (
        <SectionCard title="Trace">
          <p className="text-sm text-muted">
            {run.traceExecution
              ? 'Trace recording was enabled — the Playwright trace viewer opens here once the runtime is connected.'
              : 'Trace recording was disabled for this run.'}
          </p>
        </SectionCard>
      )}
    </div>
  );
}
