/*
 * Client-side API for the Design module. Everything the UI shows is backed by
 * these calls — requirements, test plans, suites, cases, approvals — proxied
 * through /api to the NestJS backend so the session cookie stays first-party.
 */
import type {
  DesignSource,
  DesignStatus,
  RequirementStatus,
  TestCasePriority,
} from '@cognitest/shared';

export interface TestDesign {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  source: DesignSource;
  status: DesignStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  requirementCount: number;
  suiteCount: number;
  caseCount: number;
}

export interface Requirement {
  id: string;
  title: string;
  description: string | null;
  status: RequirementStatus;
  designId: string | null;
  createdAt: string;
}

export interface TestPlan {
  id: string;
  title: string;
  description: string | null;
  status: DesignStatus; // test plans share the draft/in_review/approved/archived set
  version: number;
  requirementId: string | null;
}

export interface TestSuite {
  id: string;
  title: string;
  description: string | null;
}

export interface TestStep {
  action: string;
  expected?: string;
}

export interface TestCase {
  id: string;
  title: string;
  description: string | null;
  steps: TestStep[];
  priority: TestCasePriority;
}

export interface Approval {
  id: string;
  version: number;
  status: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
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

/** Builds a Design-module client scoped to one organisation + project. */
export function designApi(organizationId: string, projectId: string) {
  const base = `/api/organizations/${organizationId}/projects/${projectId}`;
  const designBase = (designId: string) => `${base}/designs/${designId}`;

  return {
    listDesigns: () => request<{ designs: TestDesign[] }>(`${base}/designs`),
    createDesign: (body: { name: string; description?: string; source?: DesignSource }) =>
      request<{ design: TestDesign }>(`${base}/designs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesign: (designId: string) =>
      request<{ design: TestDesign }>(designBase(designId)),
    updateDesign: (designId: string, body: { name?: string; description?: string | null }) =>
      request<{ design: TestDesign }>(designBase(designId), {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteDesign: (designId: string) =>
      request<{ message: string }>(designBase(designId), { method: 'DELETE' }),
    submitDesign: (designId: string) =>
      request<{ design: TestDesign }>(`${designBase(designId)}/submit`, { method: 'POST' }),
    decideDesign: (designId: string, decision: 'approved' | 'rejected', comment?: string) =>
      request<{ design: TestDesign }>(`${designBase(designId)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      }),
    listDesignApprovals: (designId: string) =>
      request<{ approvals: Approval[] }>(`${designBase(designId)}/approvals`),

    listRequirements: (designId: string) =>
      request<{ requirements: Requirement[] }>(`${designBase(designId)}/requirements`),
    createRequirement: (designId: string, body: { title: string; description?: string }) =>
      request<{ requirement: Requirement }>(`${designBase(designId)}/requirements`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateRequirement: (
      designId: string,
      requirementId: string,
      body: { title?: string; description?: string | null; status?: RequirementStatus },
    ) =>
      request<{ requirement: Requirement }>(
        `${designBase(designId)}/requirements/${requirementId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      ),
    deleteRequirement: (designId: string, requirementId: string) =>
      request<{ message: string }>(`${designBase(designId)}/requirements/${requirementId}`, {
        method: 'DELETE',
      }),

    listPlans: (designId: string) =>
      request<{ testPlans: TestPlan[] }>(`${designBase(designId)}/test-plans`),
    createPlan: (designId: string, body: { title: string; description?: string }) =>
      request<{ testPlan: TestPlan }>(`${designBase(designId)}/test-plans`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    generateArtifacts: (designId: string) =>
      request<{ testPlan: TestPlan; suiteCount: number; caseCount: number }>(
        `${designBase(designId)}/generate`,
        { method: 'POST' },
      ),
    updatePlan: (planId: string, body: { title?: string; description?: string | null }) =>
      request<{ testPlan: TestPlan }>(`${base}/test-plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archivePlan: (planId: string) =>
      request<{ message: string }>(`${base}/test-plans/${planId}`, { method: 'DELETE' }),
    submitPlan: (planId: string) =>
      request<{ testPlan: TestPlan }>(`${base}/test-plans/${planId}/submit`, { method: 'POST' }),
    decidePlan: (planId: string, decision: 'approved' | 'rejected', comment?: string) =>
      request<{ testPlan: TestPlan }>(`${base}/test-plans/${planId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      }),

    listSuites: (planId: string) =>
      request<{ testSuites: TestSuite[] }>(`${base}/test-plans/${planId}/suites`),
    createSuite: (planId: string, body: { title: string; description?: string }) =>
      request<{ testSuite: TestSuite }>(`${base}/test-plans/${planId}/suites`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateSuite: (suiteId: string, body: { title?: string; description?: string | null }) =>
      request<{ testSuite: TestSuite }>(`${base}/test-suites/${suiteId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteSuite: (suiteId: string) =>
      request<{ message: string }>(`${base}/test-suites/${suiteId}`, { method: 'DELETE' }),
    listCases: (suiteId: string) =>
      request<{ testCases: TestCase[] }>(`${base}/test-suites/${suiteId}/cases`),
    createCase: (
      suiteId: string,
      body: { title: string; description?: string; steps?: TestStep[]; priority?: TestCasePriority },
    ) =>
      request<{ testCase: TestCase }>(`${base}/test-suites/${suiteId}/cases`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateCase: (
      caseId: string,
      body: { title?: string; description?: string | null; priority?: TestCasePriority },
    ) =>
      request<{ testCase: TestCase }>(`${base}/test-cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteCase: (caseId: string) =>
      request<{ message: string }>(`${base}/test-cases/${caseId}`, { method: 'DELETE' }),
  };
}

export type DesignApi = ReturnType<typeof designApi>;
