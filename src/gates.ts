import type { ProbeFact, SnapshotResult } from './broker.ts';
import type { ControllerContext } from './controller-context.ts';
import type { CheckpointSelection } from './checkpoints.ts';

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
  runId: string;
  checkpoint?: CheckpointSelection;
  suite: { id: string; version: string; digest: string };
  testCounts: { executed: number; skipped: number; passed: number; failed: number };
  gates: Array<EvaluatedGate & { tests: TestObservation[] }>;
}
export interface TestObservation {
  id: string;
  result: 'PASS' | 'FAIL' | 'SKIP';
  evidence: string;
  diagnostic?: { message: string; expected?: string; actual?: string; path?: string; line?: number; logRef?: string; artifactRef?: string };
}
export interface TrustedRunInput {
  schemaVersion: 2;
  taskId: string;
  runId: string;
  stage: string;
  snapshotIdentity: string;
  suite: { id: string; version: string; digest: string };
  testCounts: { executed: number; skipped: number; passed: number; failed: number };
  execution: { exitCode: number };
  gates: { id: string; tests: TestObservation[] }[];
}
export type GateReport = LegacyGateReport | TrustedGateReport;
export interface GateSet { gates: Array<Gate & { fromStage: string }>; source: LegacyGateReport['source'] }

/** Validate a framework-neutral runner result against an independent host inventory. */
export function normalizeGateReport(input: unknown, context: ControllerContext, previous?: GateReport): TrustedGateReport {
  const bad = (message: string): never => { throw new Error(`Blocked gate report: ${message}`); };
  let size: number;
  try { size = JSON.stringify(input).length; } catch { return bad('unserializable report'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || size > 1024 * 1024)
    return bad('missing or oversized report');
  const report = input as Record<string, unknown>;
  if (Object.keys(report).some(key => !['schemaVersion', 'taskId', 'runId', 'stage', 'snapshotIdentity', 'suite', 'testCounts', 'execution', 'gates'].includes(key)))
    return bad('caller-supplied criteria or unexpected report field');
  if (typeof report.runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(report.runId)) return bad('missing run identity');
  if (previous?.schemaVersion === 2 && previous.taskId === context.taskId && previous.runId === report.runId)
    return bad('stale run identity');
  if (report.schemaVersion !== 2 || report.taskId !== context.taskId || report.stage !== context.stage ||
      report.snapshotIdentity !== context.sourceSnapshot) return bad('task, stage, schema, or source mismatch');
  const suite = report.suite as Record<string, unknown> | undefined;
  if (!suite || Object.keys(suite).some(key => !['id', 'version', 'digest'].includes(key)) ||
      suite.id !== context.suite.id || suite.version !== context.suite.version || suite.digest !== context.suite.digest)
    return bad('protected suite identity mismatch');
  const claimed = report.testCounts as Record<string, unknown> | undefined;
  if (!claimed || Object.keys(claimed).sort().join(',') !== 'executed,failed,passed,skipped' ||
      Object.values(claimed).some(value => !Number.isSafeInteger(value) || (value as number) < 0)) return bad('invalid test counts');
  const execution = report.execution as Record<string, unknown> | undefined;
  if (!execution || Object.keys(execution).join(',') !== 'exitCode' || !Number.isSafeInteger(execution.exitCode) ||
      ![0, 1].includes(execution.exitCode as number)) return bad('invalid execution status');
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
    const tests = new Map<string, TestObservation>();
    for (const raw of row.tests) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !['id', 'result', 'evidence', 'diagnostic'].includes(key)) ||
          typeof raw.id !== 'string' ||
          !expected.testIds.includes(raw.id) || tests.has(raw.id) || !['PASS', 'FAIL', 'SKIP'].includes(raw.result) ||
          typeof raw.evidence !== 'string' || raw.evidence.length > 8192 ||
          (raw.result !== 'SKIP' && !raw.evidence.trim())) return bad('duplicate, unknown, or malformed test row');
      if (raw.diagnostic !== undefined) {
        const d = raw.diagnostic;
        if (!d || typeof d !== 'object' || Array.isArray(d) ||
            Object.keys(d).some(key => !['message', 'expected', 'actual', 'path', 'line', 'logRef', 'artifactRef'].includes(key)) ||
            typeof d.message !== 'string' || d.message.length > 4096 ||
            ['expected', 'actual', 'path', 'logRef', 'artifactRef'].some(key => d[key] !== undefined &&
              (typeof d[key] !== 'string' || d[key].length > 4096)) ||
            (d.line !== undefined && (!Number.isSafeInteger(d.line) || d.line < 1))) return bad('malformed assertion diagnostic');
      }
      tests.set(raw.id, { id: raw.id, result: raw.result, evidence: raw.evidence, ...(raw.diagnostic === undefined ? {} : { diagnostic: raw.diagnostic }) });
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
  const all = gates.flatMap(gate => gate.tests);
  const actual = { executed: all.filter(test => test.result !== 'SKIP').length,
    skipped: all.filter(test => test.result === 'SKIP').length,
    passed: all.filter(test => test.result === 'PASS').length,
    failed: all.filter(test => test.result === 'FAIL').length };
  if (Object.keys(actual).some(key => actual[key as keyof typeof actual] !== claimed[key])) return bad('spoofed test counts');
  if ((execution.exitCode === 0 && actual.failed > 0) || (execution.exitCode !== 0 && actual.failed === 0))
    return bad('exit status does not match assertion results');
  const prior = new Map(previous?.schemaVersion === 2 && previous.taskId === context.taskId &&
    previous.suite.digest === context.suite.digest ? previous.gates.map(gate => [gate.id, gate.result]) : []);
  const regressions = gates.filter(gate => prior.get(gate.id) === 'PASS' && gate.result === 'FAIL').map(gate => gate.id);
  return { schemaVersion: 2, taskId: context.taskId, runId: report.runId, stage: context.stage, snapshotIdentity: context.sourceSnapshot,
    snapshotFiles: 0, source: 'reviewed', suite: { id: context.suite.id, version: context.suite.version, digest: context.suite.digest },
    counts, testCounts: actual, gates, regressions, missingDeliverables: gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
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
