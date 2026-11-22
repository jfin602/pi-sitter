import type { ProbeFact, SnapshotResult } from './broker.ts';
import type { ControllerContext } from './controller-context.ts';

export type GateResult = 'PASS' | 'FAIL' | 'UNVERIFIED';
export interface Gate {
  id: string;
  requirement: string;
  source: { path: string; line: number; promptSha256: string; sourcePrompt: string };
  method: { kind: string; fact: string };
}
export interface EvaluatedGate extends Gate {
  result: GateResult;
  evidence: string;
  explanation: string;
  fromStage: string;
  repairAction?: string;
}
export interface LegacyGateReport {
  schemaVersion: 1;
  stage: string;
  snapshotIdentity: string;
  snapshotFiles: number;
  supervisorSessionFile?: string;
  source: 'reviewed' | 'explicit_overrides' | 'explicit';
  counts: Record<GateResult, number>;
  gates: EvaluatedGate[];
  regressions: string[];
  missingDeliverables: string[];
  validationLimitations: string[];
}
export interface TrustedGateReport extends Omit<LegacyGateReport, 'schemaVersion'> {
  schemaVersion: 2;
  taskId: string;
  suite: { id: string; version: string; digest: string };
  gates: Array<EvaluatedGate & { tests: { id: string; result: 'PASS' | 'FAIL' | 'SKIP'; evidence: string }[] }>;
}
export interface TrustedRunInput {
  schemaVersion: 2;
  taskId: string;
  stage: string;
  snapshotIdentity: string;
  suite: { id: string; version: string; digest: string };
  gates: { id: string; tests: { id: string; result: 'PASS' | 'FAIL' | 'SKIP'; evidence: string }[] }[];
}
export type GateReport = LegacyGateReport | TrustedGateReport;
export interface GateSet { gates: Array<Gate & { fromStage: string }>; source: LegacyGateReport['source'] }

/** Validate a framework-neutral runner result against an independent host inventory. */
export function normalizeGateReport(input: unknown, context: ControllerContext, previous?: GateReport): TrustedGateReport {
  const bad = (message: string): never => { throw new Error(`Blocked gate report: ${message}`); };
  if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 1024 * 1024)
    return bad('missing or oversized report');
  const report = input as Record<string, unknown>;
  if (Object.keys(report).some(key => !['schemaVersion', 'taskId', 'stage', 'snapshotIdentity', 'suite', 'gates'].includes(key)))
    return bad('caller-supplied criteria or unexpected report field');
  if (report.schemaVersion !== 2 || report.taskId !== context.taskId || report.stage !== context.stage ||
      report.snapshotIdentity !== context.sourceSnapshot) return bad('task, stage, schema, or source mismatch');
  const suite = report.suite as Record<string, unknown> | undefined;
  if (!suite || Object.keys(suite).some(key => !['id', 'version', 'digest'].includes(key)) ||
      suite.id !== context.suite.id || suite.version !== context.suite.version || suite.digest !== context.suite.digest)
    return bad('protected suite identity mismatch');
  if (!Array.isArray(report.gates) || report.gates.length !== context.suite.gates.length) return bad('missing expected gate');
  const observed = new Map<string, Record<string, unknown>>();
  for (const row of report.gates) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['id', 'tests'].includes(key)) ||
        typeof row.id !== 'string' || observed.has(row.id) ||
        !context.suite.gates.some(gate => gate.id === row.id)) return bad('duplicate or unknown gate ID');
    observed.set(row.id, row);
  }
  const gates: TrustedGateReport['gates'] = [];
  for (const expected of context.suite.gates) {
    const row = observed.get(expected.id);
    if (!row || !Array.isArray(row.tests) || row.tests.length !== expected.testIds.length) return bad('missing expected test row');
    const tests = new Map<string, { id: string; result: 'PASS' | 'FAIL' | 'SKIP'; evidence: string }>();
    for (const raw of row.tests) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !['id', 'result', 'evidence'].includes(key)) ||
          typeof raw.id !== 'string' ||
          !expected.testIds.includes(raw.id) || tests.has(raw.id) || !['PASS', 'FAIL', 'SKIP'].includes(raw.result) ||
          typeof raw.evidence !== 'string' || raw.evidence.length > 8192 ||
          (raw.result !== 'SKIP' && !raw.evidence.trim())) return bad('duplicate, unknown, or malformed test row');
      tests.set(raw.id, { id: raw.id, result: raw.result, evidence: raw.evidence });
    }
    const ordered = expected.testIds.map(testId => tests.get(testId)!).filter(Boolean);
    if (ordered.length !== expected.testIds.length) return bad('missing expected test ID');
    const result: GateResult = ordered.some(test => test.result === 'FAIL') ? 'FAIL' :
      ordered.some(test => test.result === 'SKIP') ? 'UNVERIFIED' : 'PASS';
    const requirement = expected.requirementIds.map(id => context.originalTask.requirements.find(req => req.id === id)!.text).join('\n');
    gates.push({ id: expected.id, requirement, source: { path: context.originalTask.reference, line: 1,
      promptSha256: context.suite.digest, sourcePrompt: context.originalTask.text.slice(0, 700) },
      method: { kind: 'protected_tests', fact: expected.testIds.join(', ') }, fromStage: context.stage,
      result, evidence: ordered.filter(test => test.result !== 'PASS').map(test => `${test.id}: ${test.evidence}`).join('\n') ||
        ordered.map(test => `${test.id}: ${test.evidence}`).join('\n').slice(0, 8192),
      explanation: result === 'UNVERIFIED' ? 'Mandatory test was skipped' : '', tests: ordered });
  }
  const counts = { PASS: 0, FAIL: 0, UNVERIFIED: 0 };
  for (const gate of gates) counts[gate.result]++;
  const prior = new Map(previous?.schemaVersion === 2 && previous.taskId === context.taskId &&
    previous.suite.digest === context.suite.digest ? previous.gates.map(gate => [gate.id, gate.result]) : []);
  const regressions = gates.filter(gate => prior.get(gate.id) === 'PASS' && gate.result === 'FAIL').map(gate => gate.id);
  return { schemaVersion: 2, taskId: context.taskId, stage: context.stage, snapshotIdentity: context.sourceSnapshot,
    snapshotFiles: 0, source: 'reviewed', suite: { id: context.suite.id, version: context.suite.version, digest: context.suite.digest },
    counts, gates, regressions, missingDeliverables: gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
    validationLimitations: gates.filter(gate => gate.result === 'UNVERIFIED').map(gate => `${gate.id}: mandatory test skipped`) };
}

/** Framework-neutral gate evaluation. Providers must supply independent PASS evidence. */
export function evaluateGateFacts(stage: string, loaded: GateSet, snapshot: SnapshotResult,
  previous?: GateReport): LegacyGateReport {
  const gates: EvaluatedGate[] = loaded.gates.map(gate => {
    const fact: ProbeFact | undefined = snapshot.probe.facts[gate.method.fact];
    const result: GateResult = fact?.result === 'PASS' && fact.evidence.trim() ? 'PASS'
      : fact?.result === 'FAIL' ? 'FAIL' : 'UNVERIFIED';
    const evidence = fact?.evidence ?? '';
    const explanation = result === 'PASS' ? '' : result === 'FAIL'
      ? 'Independent saved-state or runtime evidence shows this requirement is unmet'
      : evidence || snapshot.probe.errors[0] || `Verifier did not produce ${gate.method.fact}`;
    return { ...gate, result, evidence, explanation };
  });
  const prior = new Map(previous?.gates.map(gate => [gate.id, gate.result]) ?? []);
  const regressions = gates.filter(gate => prior.get(gate.id) === 'PASS' && gate.result === 'FAIL').map(gate => gate.id);
  const counts = { PASS: 0, FAIL: 0, UNVERIFIED: 0 };
  for (const gate of gates) counts[gate.result]++;
  const missingDeliverables = gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id);
  const validationLimitations = [...snapshot.probe.errors,
    ...gates.filter(gate => gate.result === 'UNVERIFIED').map(gate => `${gate.id}: ${gate.explanation}`)].slice(0, 100);
  return { schemaVersion: 1, stage, snapshotIdentity: snapshot.identity, snapshotFiles: snapshot.files,
    source: loaded.source, counts, gates, regressions, missingDeliverables, validationLimitations };
}
