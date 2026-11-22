import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateControllerContext } from '../src/controller-context.ts';
import { selectCheckpoint, checkpointContext } from '../src/checkpoints.ts';
import { createPiSitter } from '../src/index.ts';

const SHA_A = 'a'.repeat(64), SHA_B = 'b'.repeat(64), DIGEST = 'c'.repeat(64);
function controller(sourceSnapshot = SHA_A) {
  return validateControllerContext({ schemaVersion: 1, taskId: 'task', stage: 'stage',
    originalTask: { text: 'Requirement A\nRequirement B', reference: 'task', version: 'v1',
      requirements: [{ id: 'A', text: 'Requirement A' }, { id: 'B', text: 'Requirement B' }] },
    suite: { id: 'suite', version: 'v1', digest: DIGEST,
      gates: [{ id: 'A', requirementIds: ['A'], testIds: ['A-test'] },
        { id: 'B', requirementIds: ['B'], testIds: ['B-test'] }] },
    sourceSnapshot }, 'stage');
}

test('milestone selects approved subset; final covers the complete manifest', () => {
  const ctx = controller();
  const milestone = selectCheckpoint(ctx, { reason: 'milestone', milestoneId: 'M1', gateIds: ['A'] });
  assert.deepEqual(milestone.gateIds, ['A']);
  assert.deepEqual(checkpointContext(ctx, milestone).suite.gates.map(g => g.id), ['A']);
  assert.deepEqual(selectCheckpoint(ctx, { reason: 'final', milestoneId: 'final' }).gateIds, ['A', 'B']);
  assert.throws(() => selectCheckpoint(ctx, { reason: 'final', milestoneId: 'final', gateIds: ['A'] }), /every mandatory gate/);
  assert.throws(() => selectCheckpoint(ctx, { reason: 'milestone', milestoneId: 'M1', gateIds: ['foreign'] }), /gate subset/);
});

test('post-repair requires a new source and includes failed gates', () => {
  const previous = { schemaVersion: 2, taskId: 'task', snapshotIdentity: SHA_A,
    suite: { id: 'suite', version: 'v1', digest: DIGEST }, gates: [{ id: 'A', result: 'FAIL' }, { id: 'B', result: 'PASS' }] };
  assert.throws(() => selectCheckpoint(controller(SHA_A), { reason: 'post_repair',
    milestoneId: 'M1', gateIds: ['A'], regressionGateIds: ['B'] }, previous), /fresh source/);
  assert.throws(() => selectCheckpoint(controller(SHA_B), { reason: 'post_repair',
    milestoneId: 'M1', gateIds: ['B'] }, previous), /omitted a failed gate/);
  assert.deepEqual(selectCheckpoint(controller(SHA_B), { reason: 'post_repair',
    milestoneId: 'M1', gateIds: ['A'], regressionGateIds: ['B'] }, previous).gateIds, ['A', 'B']);
});

test('ordinary tool edits do not verify; one milestone run and final full run use separate IDs', async () => {
  process.env.PI_SITTER_MODE = 'shadow';
  process.env.PI_SITTER_STAGE = 'stage';
  const handlers = new Map(), entries = [];
  let request = { reason: 'milestone', milestoneId: 'M1', gateIds: ['A'] };
  const seen = [];
  const pi = { on(name, fn) { const old = handlers.get(name); handlers.set(name, old ? async (...args) => {
    await old(...args); return fn(...args);
  } : fn); }, registerCommand() {}, registerEntryRenderer() {}, registerMessageRenderer() {},
  getActiveTools: () => [], appendEntry(customType, data) { entries.push({ type: 'custom', customType, data }); },
  sendMessage() {} };
  const ctx = { cwd: '/live', hasUI: true, isIdle: () => true,
    sessionManager: { getBranch: () => entries, getSessionId: () => 'session' },
    ui: { theme: { fg: (_token, text) => text },
      setStatus() {}, setWidget() {}, notify() {}, setWorkingMessage() {}, setWorkingVisible() {} } };
  createPiSitter({ loadControllerContext: () => controller(), loadCheckpoint: () => request,
    verify: async (_stage, _root, options) => {
      seen.push(options.checkpoint);
      const gates = options.checkpoint.gateIds.map(id => ({ id,
        tests: [{ id: `${id}-test`, result: 'PASS', evidence: 'scored assertion passed' }] }));
      return { schemaVersion: 2, taskId: 'task', runId: randomUUID(), stage: 'stage',
        snapshotIdentity: SHA_A, suite: { id: 'suite', version: 'v1', digest: DIGEST },
        testCounts: { executed: gates.length, skipped: 0, passed: gates.length, failed: 0 },
        execution: { exitCode: 0 }, gates };
    } })(pi);
  handlers.get('session_start')({}, ctx);
  await handlers.get('tool_execution_end')({ toolCallId: 'edit', toolName: 'write',
    result: { content: [{ type: 'text', text: 'saved' }] }, isError: false }, ctx);
  assert.equal(seen.length, 0);
  const settle = () => handlers.get('agent_before_settle')({ outcome: 'completed', entries: [], continue: false }, ctx);
  await settle();
  await settle();
  assert.equal(seen.length, 1);
  assert.equal(entries.filter(e => e.customType === 'pi-sitter-verification-attempt').length, 1);
  assert.equal(entries.filter(e => e.customType === 'pi-sitter-verification-pending').length, 1);
  assert.deepEqual(seen[0].gateIds, ['A']);
  request = { reason: 'final', milestoneId: 'final' };
  await settle();
  assert.deepEqual(seen[1].gateIds, ['A', 'B']);
  assert.notEqual(entries.filter(e => e.customType === 'pi-sitter-verification').at(0).data.runId,
    entries.filter(e => e.customType === 'pi-sitter-verification').at(1).data.runId);
});

test('completion rerun after repair uses the fresh source and retains regression gates', async () => {
  process.env.PI_SITTER_MODE = 'shadow';
  process.env.PI_SITTER_STAGE = 'stage';
  const handlers = new Map(), entries = [], seen = [];
  let snapshot = SHA_A, runs = 0;
  const pi = { on(name, fn) { const old = handlers.get(name); handlers.set(name, old ? async (...args) => {
    await old(...args); return fn(...args);
  } : fn); }, registerCommand() {}, registerEntryRenderer() {}, registerMessageRenderer() {},
  getActiveTools: () => [], appendEntry(customType, data) { entries.push({ type: 'custom', customType, data }); },
  sendMessage() {} };
  const ctx = { cwd: '/live', hasUI: false, isIdle: () => true,
    sessionManager: { getBranch: () => entries, getSessionId: () => 'session' },
    ui: { setStatus() {}, setWidget() {}, notify() {} } };
  createPiSitter({ loadControllerContext: () => controller(snapshot),
    verify: async (_stage, _root, { checkpoint }) => {
      seen.push(checkpoint);
      const fail = runs++ === 0;
      return { schemaVersion: 2, taskId: 'task', runId: randomUUID(), stage: 'stage',
        snapshotIdentity: snapshot, suite: { id: 'suite', version: 'v1', digest: DIGEST },
        testCounts: { executed: 2, skipped: 0, passed: fail ? 1 : 2, failed: fail ? 1 : 0 },
        execution: { exitCode: fail ? 1 : 0 },
        gates: ['A', 'B'].map(id => ({ id, tests: [{ id: `${id}-test`,
          result: fail && id === 'A' ? 'FAIL' : 'PASS', evidence: 'scored assertion' }] })) };
    } })(pi);
  handlers.get('session_start')({}, ctx);
  const settle = () => handlers.get('agent_before_settle')({ outcome: 'completed', entries: [], continue: false }, ctx);
  await settle();
  assert.equal(seen[0].reason, 'final');
  snapshot = SHA_B;
  await settle();
  assert.equal(seen[1].reason, 'post_repair');
  assert.equal(seen[1].snapshotId, SHA_B);
  assert.deepEqual(seen[1].gateIds, ['A', 'B']);
  assert.equal(entries.filter(e => e.customType === 'pi-sitter-verification').at(-1).data.snapshotIdentity, SHA_B);
});
