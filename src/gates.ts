import type { ProbeFact, SnapshotResult } from './broker.ts';

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
export interface GateReport {
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
export interface GateSet { gates: Array<Gate & { fromStage: string }>; source: GateReport['source'] }

/** Framework-neutral gate evaluation. Providers must supply independent PASS evidence. */
export function evaluateGateFacts(stage: string, loaded: GateSet, snapshot: SnapshotResult,
  previous?: GateReport): GateReport {
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
