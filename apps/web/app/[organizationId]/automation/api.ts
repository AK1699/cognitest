/*
 * Client-side API for the Automation module — automations, their executable
 * test cases and run records. Proxied through /api to the NestJS backend so the
 * session cookie stays first-party. Dates arrive as ISO strings over the wire.
 */
import type {
  AutomationFramework,
  AutomationMethod,
  AutomationRunStatus,
  AutomationStatus,
  AutomationTestStatus,
  TestCasePriority,
  TestStep,
} from '@cognitest/shared';

export type { TestStep };

export interface AutomationStep {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
}

export interface AutomationEnvironment {
  name: string;
  baseUrl?: string;
}

export interface AutomationVariable {
  name: string;
  value: string;
  secret?: boolean;
}

export interface AutomationConfig {
  defaultBrowser?: string;
  baseUrl?: string;
  parallelExecution?: boolean;
  retryOnFailure?: boolean;
  retries?: number;
  timeoutSeconds?: number;
  environments?: AutomationEnvironment[];
  notifyOnFailure?: boolean;
  notifyOnSuccess?: boolean;
  ciProvider?: string;
  variables?: AutomationVariable[];
}

export interface Automation {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  method: AutomationMethod;
  framework: AutomationFramework;
  status: AutomationStatus;
  tags: string[];
  flow: AutomationStep[];
  config: AutomationConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // derived (list + get return the summary shape)
  testCount: number;
  passedCount: number;
  failedCount: number;
  lastRunStatus: AutomationRunStatus | null;
  lastRunAt: string | null;
}

export interface AutomationTest {
  id: string;
  organizationId: string;
  automationId: string;
  key: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: TestCasePriority;
  tags: string[];
  preconditions: string[];
  steps: TestStep[];
  expectedResult: string | null;
  code: string | null;
  lastStatus: AutomationTestStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunResult {
  testId: string | null;
  name: string;
  status: AutomationTestStatus;
  durationMs: number;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: AutomationRunStatus;
  environment: string | null;
  browser: string | null;
  workers: number;
  headless: boolean;
  captureScreenshots: boolean;
  captureVideo: boolean;
  traceExecution: boolean;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number | null;
  results: AutomationRunResult[];
  logs: string[];
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationBody {
  name: string;
  description?: string;
  method?: AutomationMethod;
  framework?: AutomationFramework;
  tags?: string[];
  flow?: AutomationStep[];
  config?: AutomationConfig;
}

export interface UpdateAutomationBody {
  name?: string;
  description?: string | null;
  framework?: AutomationFramework;
  status?: AutomationStatus;
  tags?: string[];
  flow?: AutomationStep[];
  config?: AutomationConfig;
}

export interface CreateTestBody {
  title: string;
  key?: string;
  description?: string;
  category?: string;
  priority?: TestCasePriority;
  tags?: string[];
  preconditions?: string[];
  steps?: TestStep[];
  expectedResult?: string;
  code?: string;
}

export interface UpdateTestBody {
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: TestCasePriority;
  tags?: string[];
  preconditions?: string[];
  steps?: TestStep[];
  expectedResult?: string | null;
  code?: string | null;
  status?: AutomationTestStatus;
}

export interface RunBody {
  environment?: string;
  browser?: string;
  workers?: number;
  headless?: boolean;
  captureScreenshots?: boolean;
  captureVideo?: boolean;
  traceExecution?: boolean;
}

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (Array.isArray(payload?.message)) return payload.message.map(String).join('. ');
  if (typeof payload?.message === 'string') return payload.message;
  return 'Something went wrong — try again';
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

/** Builds an Automation-module client scoped to one organisation + project. */
export function automationApi(organizationId: string, projectId: string) {
  const base = `/api/organizations/${organizationId}/projects/${projectId}/automations`;
  const one = (id: string) => `${base}/${id}`;

  return {
    list: () => request<{ automations: Automation[] }>(base),
    create: (body: CreateAutomationBody) =>
      request<{ automation: Automation }>(base, { method: 'POST', body: JSON.stringify(body) }),
    get: (id: string) => request<{ automation: Automation }>(one(id)),
    update: (id: string, body: UpdateAutomationBody) =>
      request<{ automation: Automation }>(one(id), {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (id: string) => request<{ message: string }>(one(id), { method: 'DELETE' }),
    generate: (id: string) =>
      request<{ generated: number }>(`${one(id)}/generate`, { method: 'POST' }),

    listTests: (id: string) => request<{ tests: AutomationTest[] }>(`${one(id)}/tests`),
    createTest: (id: string, body: CreateTestBody) =>
      request<{ test: AutomationTest }>(`${one(id)}/tests`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getTest: (id: string, testId: string) =>
      request<{ test: AutomationTest }>(`${one(id)}/tests/${testId}`),
    updateTest: (id: string, testId: string, body: UpdateTestBody) =>
      request<{ test: AutomationTest }>(`${one(id)}/tests/${testId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteTest: (id: string, testId: string) =>
      request<{ message: string }>(`${one(id)}/tests/${testId}`, { method: 'DELETE' }),

    listRuns: (id: string) => request<{ runs: AutomationRun[] }>(`${one(id)}/runs`),
    run: (id: string, body: RunBody) =>
      request<{ run: AutomationRun }>(`${one(id)}/runs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getRun: (id: string, runId: string) =>
      request<{ run: AutomationRun }>(`${one(id)}/runs/${runId}`),
    cancelRun: (id: string, runId: string) =>
      request<{ run: AutomationRun }>(`${one(id)}/runs/${runId}/cancel`, { method: 'POST' }),
  };
}

export type AutomationApi = ReturnType<typeof automationApi>;
