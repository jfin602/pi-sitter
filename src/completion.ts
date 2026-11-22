import type { EvaluatedGate, GateReport } from './gates.ts';

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

export function createRecoveryPlan(report: GateReport, task: string,
  actionForGate: (gate: EvaluatedGate) => string = gate => `Inspect the saved artifacts for “${gate.requirement}”, correct only the unmet behavior, and rerun its verification.`): RecoveryPlan | undefined {
  const failed = report.gates.filter(gate => gate.result === 'FAIL');
  if (failed.length === 0) return undefined;
  const focus = failed.slice(0, 3);
  const failedGateIds = failed.map(gate => gate.id);
  const lines = [`Pi Sitter Recovery — Stage ${report.stage}`,
    `Continue the current Worker task: ${task.slice(0, 300)}`,
    `Saved snapshot: ${report.snapshotIdentity}`,
    `Failed gate IDs: ${failedGateIds.join(', ')}`,
    ...(report.regressions.length ? [`Regressed gate IDs: ${report.regressions.join(', ')}`] : []),
    `Focus on these unresolved requirements first:`];
  for (const gate of focus) lines.push(`\n${gate.id} — ${gate.requirement}\nEvidence: ${gate.evidence || gate.explanation}\nRequired action: ${gate.repairAction || actionForGate(gate)}`);
  lines.push('\nPreserve all functionality whose gates passed, including earlier stages. Do not rewrite unrelated files or replace working controllers. Save changes and reverify the failed gates and integration behavior before reporting completion.');
  return { stage: report.stage, snapshotIdentity: report.snapshotIdentity, failedGateIds,
    focusGateIds: focus.map(gate => gate.id), text: lines.join('\n'),
    key: `${report.stage}:${report.snapshotIdentity}:${failedGateIds.join(',')}` };
}

/** A same-snapshot Worker turn has not completed the repair already requested. */
export function noProgressRecoveryPrompt(plan: RecoveryPlan): string {
  const [heading, ...details] = plan.text.split('\n');
  return `${heading}\nThe previous repair turn ended without a saved project change. The same snapshot and failed gates remain. Inspecting or opening files alone does not carry out the required action. Perform the concrete edit listed below with an approved Worker tool, save it, and verify the resulting behavior before finishing. If the edit cannot be made, report the exact blocker instead of claiming completion.\n${details.join('\n')}`;
}
