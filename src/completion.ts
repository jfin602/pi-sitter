import type { GateReport, TrustedGateReport } from './gates.ts';
import type { AnalysisOutcome, CausalEvidenceRef } from './analysis.ts';

export type CompletionDecision = 'VERIFIED' | 'RECOVERY_REQUIRED' | 'UNVERIFIED' | 'BLOCKED';
export interface CompletionRecord {
  displayId?: string;
  runId?: string;
  stage: string;
  task: string;
  decision: CompletionDecision;
  snapshotIdentity: string;
  counts: GateReport['counts'];
  failedGateIds: string[];
  unverifiedGateIds: string[];
  regressions: string[];
  attempt: number;
  elapsedMs: number;
  reason: string;
}
export interface RecoveryPlan {
  stage: string;
  snapshotIdentity: string;
  failedGateIds: string[];
  focusGateIds: string[];
  text: string;
  key: string;
  diagnosis: RecoveryDiagnosis;
}

export interface RecoveryDiagnosis {
  trigger: 'failed_gate';
  status: 'SUPPORTED' | 'UNVERIFIED';
  task: string;
  milestone: string;
  suite?: { id: string; version: string; digest: string };
  source: string;
  run?: string;
  failedGateIds: string[];
  failedTestIds: string[];
  observed: Array<{ gateId: string; testId?: string; failure: string; path?: string; line?: number }>;
  evidenceRefs: CausalEvidenceRef[];
  likelyCause?: string;
  confidence?: number;
  uncertainty: string;
  affected: Array<{ path: string; function?: string }>;
  actions: string[];
  verification: { reason: 'post_repair'; gateIds: string[]; testIds: string[] };
  gaps: string[];
  escalation?: 'protected_suite_owner';
}

function renderRecovery(d: RecoveryDiagnosis, regressions: string[]): string {
  const lines = [`Pi Sitter Recovery — Stage ${d.milestone}`, `Continue the current Worker task: ${d.task.slice(0, 300)}`,
    `Saved snapshot: ${d.source}`, `Failed gate IDs: ${d.failedGateIds.join(', ')}`,
    ...(regressions.length ? [`Regressed gate IDs: ${regressions.join(', ')}`] : []),
    `Suite: ${d.suite ? `${d.suite.id}@${d.suite.version} (${d.suite.digest})` : 'legacy, unverified'}; run: ${d.run ?? 'unavailable'}`,
    `Diagnosis: ${d.status}${d.likelyCause ? ` — ${d.likelyCause}` : ''}`,
    `Confidence: ${d.confidence ?? 'undetermined'}; uncertainty: ${d.uncertainty}`,
    'Observed failed assertions:'];
  for (const row of d.observed) lines.push(`- ${row.gateId}${row.testId ? `/${row.testId}` : ''}${row.path ? ` at ${row.path}${row.line ? `:${row.line}` : ''}` : ''}: ${row.failure}`);
  if (d.evidenceRefs.length) lines.push('Causal evidence:', ...d.evidenceRefs.map(ref => `- ${ref.ref}: ${ref.quote}${ref.path ? ` (${ref.path}${ref.line ? `:${ref.line}` : ''})` : ''}`));
  if (d.affected.length) lines.push('Affected source:', ...d.affected.map(row => `- ${row.path}${row.function ? ` — ${row.function}` : ''}`));
  if (d.actions.length) lines.push('Ordered Worker repairs:', ...d.actions.map((action, index) => `${index + 1}. ${action}`));
  else lines.push('Next safe inspection: inspect the failed assertion and its named source location through the approved read-only broker; report the blocker if no causal location is available.');
  lines.push(`Approved verification rerun: request post_repair for gates ${d.verification.gateIds.join(', ')} (tests ${d.verification.testIds.join(', ') || 'unavailable'}) through the trusted runner after a saved source change.`);
  if (d.escalation) lines.push('Suspected protected-suite defect: escalate to the authorized test owner; do not edit the protected suite.');
  if (d.gaps.length) lines.push(`Unresolved gaps: ${d.gaps.join('; ')}`);
  lines.push('Preserve all functionality whose gates passed, including earlier stages. Do not rewrite unrelated files or replace working controllers. Save changes and reverify the failed gates and integration behavior before reporting completion.');
  return lines.join('\n');
}

export function decideCompletion(report: GateReport | undefined, error?: string): { decision: CompletionDecision; reason: string } {
  if (error || !report || report.snapshotIdentity === 'unavailable' || report.gates.length === 0)
    return { decision: 'BLOCKED', reason: error ?? 'Verification could not safely inspect a project snapshot' };
  if (report.schemaVersion === 1)
    return { decision: 'UNVERIFIED', reason: 'Legacy schema v1 is historical evidence without protected suite and task provenance' };
  const counts = { PASS: 0, FAIL: 0, UNVERIFIED: 0 };
  for (const gate of report.gates) {
    if (!(gate.result in counts)) return { decision: 'BLOCKED', reason: `Invalid gate result for ${gate.id}` };
    counts[gate.result]++;
  }
  if (Object.keys(counts).some(result => counts[result as keyof typeof counts] !== report.counts[result as keyof typeof counts]))
    return { decision: 'BLOCKED', reason: 'Gate results and report counts disagree' };
  if (counts.FAIL > 0) return { decision: 'RECOVERY_REQUIRED', reason: `${counts.FAIL} required gates failed` };
  if (counts.UNVERIFIED > 0) return { decision: 'UNVERIFIED', reason: `${counts.UNVERIFIED} required gates lack sufficient evidence` };
  return { decision: 'UNVERIFIED', reason: 'Mandatory tests passed; independent original requirement review is pending' };
}

export function createRecoveryPlan(report: GateReport, task: string): RecoveryPlan | undefined {
  const failed = report.gates.filter(gate => gate.result === 'FAIL');
  if (failed.length === 0) return undefined;
  const focus = failed.slice(0, 3);
  const failedGateIds = failed.map(gate => gate.id);
  const observed = focus.flatMap(gate => report.schemaVersion === 2 ?
    (gate as TrustedGateReport['gates'][number]).tests.filter(test => test.result === 'FAIL').map(test => ({ gateId: gate.id, testId: test.id,
      failure: test.diagnostic?.message ?? test.evidence, path: test.diagnostic?.path, line: test.diagnostic?.line })) :
    [{ gateId: gate.id, failure: gate.evidence || gate.explanation }]);
  const failedTestIds = report.schemaVersion === 2 ? failed.flatMap(gate =>
    (gate as TrustedGateReport['gates'][number]).tests.filter(test => test.result === 'FAIL').map(test => test.id)) : [];
  const diagnosis: RecoveryDiagnosis = { trigger: 'failed_gate', status: 'UNVERIFIED', task, milestone: report.stage,
    suite: report.schemaVersion === 2 ? report.suite : undefined, source: report.snapshotIdentity,
    run: report.schemaVersion === 2 ? report.runId : undefined, failedGateIds, failedTestIds, observed,
    evidenceRefs: [], uncertainty: 'The failed assertion establishes the symptom, not its root cause.',
    affected: [], actions: [], verification: { reason: 'post_repair', gateIds: failedGateIds, testIds: failedTestIds },
    gaps: ['No causally supported source repair identified'] };
  return { stage: report.stage, snapshotIdentity: report.snapshotIdentity, failedGateIds,
    focusGateIds: focus.map(gate => gate.id), text: renderRecovery(diagnosis, report.regressions), diagnosis,
    key: `${report.schemaVersion === 2 ? `${report.taskId}:${report.suite.digest}:` : ''}${report.stage}:${report.snapshotIdentity}:${failedGateIds.join(',')}` };
}

export function applyRecoveryAnalysis(plan: RecoveryPlan, report: GateReport, analysis: AnalysisOutcome): RecoveryPlan {
  if (analysis.kind !== 'ready' || !analysis.cause || analysis.confidence === undefined || analysis.confidence < 0.6 ||
    !analysis.affected?.length || !analysis.steps?.length || !analysis.evidenceRefs?.length ||
    analysis.affected.some(location => !analysis.evidenceRefs?.some(ref => ref.path === location.path)) ||
    plan.snapshotIdentity !== report.snapshotIdentity || plan.stage !== report.stage ||
    (report.schemaVersion === 2 && (plan.diagnosis.run !== report.runId || plan.diagnosis.suite?.digest !== report.suite.digest))) return plan;
  const suspectedSuite = /(?:protected|acceptance) (?:suite|test|assertion) (?:is |appears |may be )?(?:wrong|defective|incorrect|broken)/i.test(analysis.cause);
  const diagnosis: RecoveryDiagnosis = { ...plan.diagnosis, status: suspectedSuite ? 'UNVERIFIED' : 'SUPPORTED',
    likelyCause: analysis.cause, confidence: analysis.confidence,
    uncertainty: analysis.uncertainty || 'Causal inference requires confirmation by the approved rerun.',
    evidenceRefs: analysis.evidenceRefs, affected: suspectedSuite ? [] : analysis.affected,
    actions: suspectedSuite ? [] : analysis.steps, gaps: suspectedSuite ? ['Protected suite owner review required'] : [],
    escalation: suspectedSuite ? 'protected_suite_owner' : undefined };
  return { ...plan, diagnosis, text: renderRecovery(diagnosis, report.regressions) };
}

/** A same-snapshot Worker turn has not completed the repair already requested. */
export function noProgressRecoveryPrompt(plan: RecoveryPlan): string {
  const [heading, ...details] = plan.text.split('\n');
  const next = plan.diagnosis.status === 'SUPPORTED' ?
    'Perform the concrete edit listed below with an approved Worker tool, save it, and verify the resulting behavior before finishing.' :
    'The cause remains UNVERIFIED. Perform only the bounded safe inspection below; report the exact blocker instead of guessing a repair.';
  return `${heading}\nThe previous repair turn ended without a saved project change. The same snapshot and failed gates remain. ${next}\n${details.join('\n')}`;
}
