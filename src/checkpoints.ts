import type { ControllerContext } from './controller-context.ts';
import type { GateReport } from './gates.ts';

export type VerificationReason = 'milestone' | 'final' | 'post_repair' | 'manual';
export interface CheckpointRequest {
  reason: VerificationReason;
  milestoneId: string;
  gateIds?: string[];
  regressionGateIds?: string[];
}
export interface CheckpointSelection {
  reason: VerificationReason;
  taskId: string;
  milestoneId: string;
  snapshotId: string;
  suiteId: string;
  suiteDigest: string;
  gateIds: string[];
  runId?: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Resolve only controller-approved gate IDs. The host owns the checkpoint signal. */
export function selectCheckpoint(context: ControllerContext, request: CheckpointRequest,
  previous?: GateReport): CheckpointSelection {
  if (!request || !['milestone', 'final', 'post_repair', 'manual'].includes(request.reason) ||
      !ID.test(request.milestoneId))
    throw new Error('Invalid trusted verification checkpoint');
  const all = context.suite.gates.map(gate => gate.id);
  const requested = request.gateIds ?? all;
  const regressions = request.regressionGateIds ?? [];
  if (!Array.isArray(requested) || !Array.isArray(regressions) ||
      requested.length === 0 || new Set([...requested, ...regressions]).size !== requested.length + regressions.length ||
      ![...requested, ...regressions].every(id => typeof id === 'string' && all.includes(id)))
    throw new Error('Invalid approved checkpoint gate subset');
  if (request.reason === 'final' && (requested.length !== all.length || regressions.length))
    throw new Error('Final verification must cover every mandatory gate');
  if (request.reason === 'post_repair') {
    if (!previous || previous.schemaVersion !== 2 || previous.taskId !== context.taskId ||
        previous.snapshotIdentity === context.sourceSnapshot || previous.suite.digest !== context.suite.digest ||
        previous.suite.id !== context.suite.id || previous.suite.version !== context.suite.version ||
        !previous.gates.some(gate => gate.result === 'FAIL'))
      throw new Error('Post-repair verification requires a fresh source and prior failed gates');
    const affected = previous.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id);
    if (!affected.every(id => requested.includes(id) || regressions.includes(id)))
      throw new Error('Post-repair verification omitted a failed gate');
  }
  return { reason: request.reason, taskId: context.taskId, milestoneId: request.milestoneId,
    snapshotId: context.sourceSnapshot, suiteId: context.suite.id, suiteDigest: context.suite.digest,
    gateIds: all.filter(id => requested.includes(id) || regressions.includes(id)) };
}

export function checkpointContext(context: ControllerContext, checkpoint: CheckpointSelection): ControllerContext {
  return { ...context, suite: { ...context.suite,
    gates: context.suite.gates.filter(gate => checkpoint.gateIds.includes(gate.id)) } };
}
