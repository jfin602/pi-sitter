import type { GateReport, TrustedGateReport } from './gates.ts';
import type { AnalysisOutcome, CausalEvidenceRef } from './analysis.ts';
import type { ControllerContext } from './controller-context.ts';
import type { InspectionReceipt } from './broker.ts';

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
  taskId?: string;
  milestoneId?: string;
  attemptSourceSnapshot?: string;
  suite?: { id: string; version: string; digest: string };
  requirements?: RequirementFinding[];
}
export type RequirementStatus = 'VERIFIED' | 'FAILED' | 'UNVERIFIED';
export interface RequirementFinding {
  id: string;
  status: RequirementStatus;
  reason: string;
  evidence: Array<{ path: string; line: number; quote: string; receipt: InspectionReceipt }>;
  limitations: string[];
}
export interface RequirementReview {
  taskId: string;
  stage: string;
  milestoneId: string;
  sourceSnapshot: string;
  suite: { id: string; version: string; digest: string };
  runId: string;
  findings: RequirementFinding[];
}

/** Host-sourced inspection receipts are required for positive and negative findings. */
export function validateRequirementReview(raw: unknown, context: ControllerContext, report: GateReport): RequirementReview {
  if (report.schemaVersion !== 2 || !report.checkpoint) throw new Error('Requirement review lacks a trusted run checkpoint');
  const review = raw as RequirementReview;
  if (!review || typeof review !== 'object' || Array.isArray(review) ||
      review.taskId !== context.taskId || review.stage !== context.stage ||
      review.milestoneId !== report.checkpoint.milestoneId || review.sourceSnapshot !== report.snapshotIdentity ||
      review.runId !== report.runId || review.suite?.id !== context.suite.id ||
      review.suite.version !== context.suite.version || review.suite.digest !== context.suite.digest ||
      !Array.isArray(review.findings) || review.findings.length > context.originalTask.requirements.length)
    throw new Error('Requirement review provenance mismatch');
  const seen = new Set<string>();
  const findings: RequirementFinding[] = [];
  for (const row of review.findings) {
    if (!row || !context.originalTask.requirements.some(req => req.id === row.id) || seen.has(row.id) ||
        !['VERIFIED', 'FAILED', 'UNVERIFIED'].includes(row.status) ||
        typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 1000 ||
        !Array.isArray(row.evidence) || row.evidence.length > 8 || !Array.isArray(row.limitations) ||
        row.limitations.length > 8 || row.limitations.some(value => typeof value !== 'string' || value.length > 500))
      throw new Error('Malformed requirement finding');
    seen.add(row.id);
    for (const item of row.evidence) {
      const receipt = item?.receipt;
      if (!item || typeof item.path !== 'string' || !item.path || item.path.length > 512 ||
          !Number.isSafeInteger(item.line) || item.line < 1 || typeof item.quote !== 'string' ||
          !item.quote.trim() || item.quote.length > 2000 || !receipt || receipt.status !== 'allowed' ||
          receipt.tool !== 'pi_sitter_inspect' || !receipt.operation || !/^[a-f0-9]{64}$/.test(receipt.resultDigest ?? '') ||
          receipt.taskId !== context.taskId || receipt.turnId !== report.runId ||
          receipt.sourceIdentity !== report.snapshotIdentity || receipt.evidenceRef !== `${report.snapshotIdentity}:${item.path}`)
        throw new Error('Requirement finding lacks current source inspection receipt');
    }
    if (row.status !== 'UNVERIFIED' && !row.evidence.length)
      throw new Error('Requirement finding lacks independent source evidence');
    findings.push({ id: row.id, status: row.status, reason: row.reason, evidence: row.evidence, limitations: row.limitations });
  }
  for (const expected of context.originalTask.requirements) if (!seen.has(expected.id))
    findings.push({ id: expected.id, status: 'UNVERIFIED', reason: 'No independent source inspection for this original requirement', evidence: [], limitations: ['Review omitted this requirement'] });
  return { ...review, findings };
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
  taskId?: string;
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

function firstRecoveryAction(d: RecoveryDiagnosis): string {
  if (d.status === 'SUPPORTED' && d.actions.length)
    return `Do now: ${d.actions[0]} Repair the existing source in place, save it, and read back the changed artifact before reporting completion.`;
  return 'Do now: inspect one existing task-related saved source artifact relevant to the failed assertion with an approved read operation. If no artifact or safe repair is supported, report the missing evidence and exact blocker; do not guess a cause.';
}

function renderRecovery(d: RecoveryDiagnosis, regressions: string[]): string {
  const lines = [`Pi Sitter protected gate recovery — ${d.failedGateIds.length} failed gate${d.failedGateIds.length === 1 ? '' : 's'}; the original task remains unfinished.`,
    firstRecoveryAction(d),
    `Task: ${d.taskId ?? 'unavailable'}; stage: ${d.milestone}; original request: ${d.task.slice(0, 300)}`,
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
  else lines.push('Next safe inspection: use one approved read of a task-related saved source artifact; report the exact blocker if no causal location is available.');
  lines.push(`Approved verification rerun: request post_repair for gates ${d.verification.gateIds.join(', ')} (tests ${d.verification.testIds.join(', ') || 'unavailable'}) through the trusted runner after a saved source change.`);
  if (d.escalation) lines.push('Suspected protected-suite defect: escalate to the authorized test owner; do not edit the protected suite.');
  if (d.gaps.length) lines.push(`Unresolved gaps: ${d.gaps.join('; ')}`);
  lines.push('Preserve all functionality whose gates passed, including earlier stages. Do not rewrite unrelated files or replace working controllers. The trusted runner controls protected gate results and reruns; do not select a test command or edit the protected suite. Report saved changes, read-back checks, and remaining failures accurately.');
  return lines.join('\n');
}

export function decideCompletion(report: GateReport | undefined, error?: string,
  context?: ControllerContext, review?: RequirementReview): { decision: CompletionDecision; reason: string } {
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
  if (!/^[a-f0-9]{64}$/.test(report.snapshotIdentity) || !report.runId || !report.suite?.digest ||
      (context && (report.taskId !== context.taskId || report.stage !== context.stage ||
        report.snapshotIdentity !== context.sourceSnapshot || report.suite.id !== context.suite.id ||
        report.suite.version !== context.suite.version || report.suite.digest !== context.suite.digest)))
    return { decision: 'BLOCKED', reason: 'Current task, source, suite, or run provenance is missing or mismatched' };
  if (context && (!report.checkpoint || report.checkpoint.taskId !== context.taskId ||
      report.checkpoint.snapshotId !== context.sourceSnapshot || report.checkpoint.suiteDigest !== context.suite.digest))
    return { decision: 'BLOCKED', reason: 'Current checkpoint provenance is missing or mismatched' };
  if (context && (report.gates.length !== report.checkpoint!.gateIds.length ||
      new Set(report.gates.map(gate => gate.id)).size !== report.gates.length ||
      new Set(report.checkpoint!.gateIds).size !== report.checkpoint!.gateIds.length ||
      report.gates.some(gate => !report.checkpoint!.gateIds.includes(gate.id))))
    return { decision: 'BLOCKED', reason: 'Reported gates differ from the approved checkpoint' };
  if (context && (report.checkpoint!.gateIds.some(id => !context.suite.gates.some(gate => gate.id === id)) ||
      report.gates.some(gate => {
        const expected = context.suite.gates.find(row => row.id === gate.id);
        return !expected || gate.tests.length !== expected.testIds.length ||
          new Set(gate.tests.map(test => test.id)).size !== gate.tests.length ||
          gate.tests.some(test => !expected.testIds.includes(test.id) || (test.result === 'PASS' && !test.evidence.trim()));
      })))
    return { decision: 'BLOCKED', reason: 'Protected gate or test inventory differs from the trusted manifest' };
  const tests = report.gates.flatMap(gate => gate.tests);
  if (tests.filter(test => test.result !== 'SKIP').length !== report.testCounts.executed ||
      tests.filter(test => test.result === 'SKIP').length !== report.testCounts.skipped ||
      tests.filter(test => test.result === 'PASS').length !== report.testCounts.passed ||
      tests.filter(test => test.result === 'FAIL').length !== report.testCounts.failed ||
      report.gates.some(gate => gate.result !== (gate.tests.some(test => test.result === 'FAIL') ? 'FAIL' :
        gate.tests.some(test => test.result === 'SKIP') ? 'UNVERIFIED' : 'PASS')))
    return { decision: 'BLOCKED', reason: 'Gate and test observations disagree' };
  if (counts.FAIL > 0) return { decision: 'RECOVERY_REQUIRED', reason: `${counts.FAIL} required gates failed` };
  if (counts.UNVERIFIED > 0) return { decision: 'UNVERIFIED', reason: `${counts.UNVERIFIED} required gates lack sufficient evidence` };
  if (context && report.gates.length !== context.suite.gates.length)
    return { decision: 'UNVERIFIED', reason: 'This checkpoint does not cover every mandatory protected gate' };
  if (context && review) {
    let findings: RequirementFinding[];
    try { findings = validateRequirementReview(review, context, report).findings; }
    catch { return { decision: 'BLOCKED', reason: 'Independent requirement review is malformed or stale' }; }
    if (findings.length !== context.originalTask.requirements.length ||
        context.originalTask.requirements.some(req => !findings.some(row => row.id === req.id)))
      return { decision: 'UNVERIFIED', reason: 'Independent review omitted original requirements' };
    const failed = findings.filter(row => row.status === 'FAILED');
    const unverified = findings.filter(row => row.status !== 'VERIFIED' && row.status !== 'FAILED');
    if (failed.length) return { decision: 'UNVERIFIED', reason: `Original requirements failed: ${failed.map(row => row.id).join(', ')}` };
    if (unverified.length) return { decision: 'UNVERIFIED', reason: `Original requirements unverified: ${unverified.map(row => row.id).join(', ')}` };
    return { decision: 'VERIFIED', reason: 'Every protected gate passed and every original requirement has current independent source evidence' };
  }
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
  const diagnosis: RecoveryDiagnosis = { trigger: 'failed_gate', status: 'UNVERIFIED', task,
    taskId: report.schemaVersion === 2 ? report.taskId : undefined, milestone: report.stage,
    suite: report.schemaVersion === 2 ? report.suite : undefined, source: report.snapshotIdentity,
    run: report.schemaVersion === 2 ? report.runId : undefined, failedGateIds, failedTestIds, observed,
    evidenceRefs: [], uncertainty: 'The failed assertion establishes the symptom, not its root cause.',
    affected: [], actions: [], verification: { reason: 'post_repair', gateIds: failedGateIds, testIds: failedTestIds },
    gaps: ['No causally supported source repair identified'] };
  return { stage: report.stage, snapshotIdentity: report.snapshotIdentity, failedGateIds,
    focusGateIds: focus.map(gate => gate.id), text: renderRecovery(diagnosis, report.regressions), diagnosis,
    key: `${report.schemaVersion === 2 ? `${report.taskId}:${report.suite.id}:${report.suite.version}:${report.suite.digest}:` : ''}${report.stage}:${report.snapshotIdentity}:${failedGateIds.join(',')}` };
}

export function applyRecoveryAnalysis(plan: RecoveryPlan, report: GateReport, analysis: AnalysisOutcome): RecoveryPlan {
  if (analysis.kind !== 'ready' || !analysis.cause || analysis.confidence === undefined || analysis.confidence < 0.6 ||
    !analysis.affected?.length || !analysis.steps?.length || !analysis.evidenceRefs?.length ||
    analysis.affected.some(location => !analysis.evidenceRefs?.some(ref => ref.path === location.path)) ||
    plan.snapshotIdentity !== report.snapshotIdentity || plan.stage !== report.stage ||
    (report.schemaVersion === 2 && (plan.diagnosis.run !== report.runId || plan.diagnosis.suite?.id !== report.suite.id ||
      plan.diagnosis.suite?.version !== report.suite.version || plan.diagnosis.suite?.digest !== report.suite.digest))) return plan;
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
  const [heading, , ...details] = plan.text.split('\n');
  return `${heading}\nNo saved source change was observed. The snapshot ${plan.snapshotIdentity} and failed gates ${plan.failedGateIds.join(', ')} are unchanged. ${firstRecoveryAction(plan.diagnosis)}\n${details.join('\n')}`;
}
