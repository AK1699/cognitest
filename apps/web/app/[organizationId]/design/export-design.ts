/*
 * Dependency-free export of a test design to PDF (via a formatted print view →
 * Save as PDF) and Excel (an HTML spreadsheet Excel opens natively). Gathers the
 * design's requirements and its plan → suite → case tree.
 */
import { renderMarkdown } from './markdown';
import type { DesignApi, Requirement, TestCase, TestDesign, TestPlan, TestSuite } from './api';

export interface DesignExport {
  requirements: Requirement[];
  plans: { plan: TestPlan; suites: { suite: TestSuite; cases: TestCase[] }[] }[];
}

/** Fetches a design's requirements + full plan/suite/case tree for export. */
export async function gatherDesignExport(api: DesignApi, designId: string): Promise<DesignExport> {
  const { requirements } = await api.listRequirements(designId);
  const { testPlans } = await api.listPlans(designId);
  const plans = await Promise.all(
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
  return { requirements, plans };
}

function esc(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

function stepsText(steps: TestCase['steps']): string {
  return steps
    .map((step) => (step.expected ? `${step.action} → ${step.expected}` : step.action))
    .join('\n');
}

function safeFile(name: string): string {
  return (name || 'design').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase();
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #22302d; margin: 32px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 2px solid #367c79; padding-bottom: 4px; color: #0a5f5b; }
  h3 { font-size: 14px; margin: 14px 0 4px; }
  h4 { font-size: 13px; margin: 10px 0 4px; color: #4b5a55; }
  .meta { color: #6b7873; margin: 0 0 12px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #e3efed; color: #0a5f5b; border-radius: 10px; padding: 2px 8px; margin-left: 6px; }
  .muted { color: #6b7873; font-style: italic; }
  .req { border: 1px solid #e1dcca; border-radius: 8px; padding: 10px 14px; margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f2efe6; }
  pre { background: #f5f2e9; padding: 8px; border-radius: 4px; white-space: pre-wrap; font-family: Menlo, monospace; font-size: 12px; margin: 4px 0; }
  code { font-family: Menlo, monospace; background: #eef3f2; padding: 1px 4px; border-radius: 3px; }
  blockquote { border-left: 3px solid #367c79; margin: 6px 0; padding: 2px 0 2px 10px; color: #6b7873; }
  @media print { body { margin: 0; } }
`;

function buildDocument(design: TestDesign, data: DesignExport, projectName?: string): string {
  const requirements =
    data.requirements
      .map(
        (req, index) => `
        <div class="req">
          <h3>REQ-${pad(index + 1)} · ${esc(req.title)}<span class="badge">${esc(req.status)}</span></h3>
          ${req.description ? `<div>${renderMarkdown(req.description)}</div>` : '<p class="muted">No description.</p>'}
        </div>`,
      )
      .join('') || '<p class="muted">No requirements.</p>';

  const artifacts =
    data.plans
      .map(
        ({ plan, suites }) => `
        <h3>${esc(plan.title)}<span class="badge">${esc(plan.status)} · v${plan.version}</span></h3>
        ${
          suites
            .map(
              ({ suite, cases }) => `
              <h4>${esc(suite.title)}</h4>
              <table>
                <thead><tr><th style="width:30%">Case</th><th style="width:12%">Priority</th><th>Steps</th></tr></thead>
                <tbody>
                  ${
                    cases
                      .map(
                        (testCase) =>
                          `<tr><td>${esc(testCase.title)}</td><td>${esc(testCase.priority)}</td><td><pre>${esc(stepsText(testCase.steps))}</pre></td></tr>`,
                      )
                      .join('') || '<tr><td colspan="3" class="muted">No cases.</td></tr>'
                  }
                </tbody>
              </table>`,
            )
            .join('') || '<p class="muted">No suites.</p>'
        }`,
      )
      .join('') || '<p class="muted">No test artifacts generated yet.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(design.name)}</title><style>${PRINT_CSS}</style></head>
    <body>
      <h1>${esc(design.name)}</h1>
      <p class="meta">${projectName ? `Project: ${esc(projectName)} · ` : ''}Source: ${esc(design.source)} · Status: ${esc(design.status)} · v${design.version}</p>
      ${design.description ? `<div>${renderMarkdown(design.description)}</div>` : ''}
      <h2>Requirements (${data.requirements.length})</h2>
      ${requirements}
      <h2>Test Artifacts</h2>
      ${artifacts}
    </body></html>`;
}

/** Opens a print-ready view of the design; the user saves it as PDF. */
export function exportDesignPdf(
  design: TestDesign,
  data: DesignExport,
  projectName?: string,
): boolean {
  const win = window.open('', '_blank');
  if (!win) return false; // popup blocked
  win.document.write(buildDocument(design, data, projectName));
  win.document.close();
  win.focus();
  // let the content render before invoking the print dialog
  win.setTimeout(() => win.print(), 300);
  return true;
}

/** Downloads an Excel-openable spreadsheet (HTML .xls) of the design. */
export function exportDesignExcel(
  design: TestDesign,
  data: DesignExport,
  projectName?: string,
): void {
  const reqRows = data.requirements
    .map(
      (req, index) =>
        `<tr><td>REQ-${pad(index + 1)}</td><td>${esc(req.title)}</td><td>${esc(req.status)}</td><td>${esc(req.description ?? '')}</td></tr>`,
    )
    .join('');
  const caseRows = data.plans
    .flatMap(({ plan, suites }) =>
      suites.flatMap(({ suite, cases }) =>
        cases.map(
          (testCase) =>
            `<tr><td>${esc(plan.title)}</td><td>${esc(suite.title)}</td><td>${esc(testCase.title)}</td><td>${esc(testCase.priority)}</td><td>${esc(stepsText(testCase.steps))}</td></tr>`,
        ),
      ),
    )
    .join('');

  const workbook = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8"></head>
    <body>
      <h3>${esc(design.name)}${projectName ? ` — ${esc(projectName)}` : ''}</h3>
      <h4>Requirements</h4>
      <table border="1"><tr><th>ID</th><th>Title</th><th>Status</th><th>Description</th></tr>${reqRows || '<tr><td colspan="4">No requirements</td></tr>'}</table>
      <br/>
      <h4>Test Cases</h4>
      <table border="1"><tr><th>Plan</th><th>Suite</th><th>Case</th><th>Priority</th><th>Steps</th></tr>${caseRows || '<tr><td colspan="5">No cases</td></tr>'}</table>
    </body></html>`;

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFile(design.name)}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
