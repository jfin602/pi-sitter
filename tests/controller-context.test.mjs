import test from 'node:test';
import assert from 'node:assert/strict';
import { PiSitterEngine } from '../src/core.ts';
import { validateControllerContext } from '../src/controller-context.ts';
import { normalizeGateReport } from '../src/gates.ts';
import { decideCompletion } from '../src/completion.ts';
import { createPiSitter } from '../src/index.ts';

const sha = 'a'.repeat(64);
const late = 'The late accessibility requirement must be retained.';
const taskText = `${'Build the requested feature. '.repeat(35)}${late}`;
const context = () => ({ schemaVersion: 1, taskId: 'task-1', stage: '04',
  originalTask: { text: taskText, reference: 'controller-task:1', version: 'v1',
    requirements: [{ id: 'R1', text: 'Build the requested feature.' }, { id: 'R2', text: late }] },
  suite: { id: 'suite-1', version: 'v1', digest: sha, gates: [
    { id: 'A', requirementIds: ['R1'], testIds: ['scored-A'] },
    { id: 'B', requirementIds: ['R2'], testIds: ['scored-B'] },
  ] }, sourceSnapshot: sha });
const row = (id, result = 'PASS') => ({ id, tests: [{ id: `scored-${id}`, result,
  evidence: result === 'SKIP' ? '' : `${id} assertion evidence` }] });
const run = (gates = [row('A'), row('B')]) => ({ schemaVersion: 2, taskId: 'task-1', stage: '04',
  runId: 'run-1', snapshotIdentity: sha, suite: { id: 'suite-1', version: 'v1', digest: sha },
  testCounts: { executed: gates.flatMap(g => g.tests).filter(t => t.result !== 'SKIP').length,
    skipped: gates.flatMap(g => g.tests).filter(t => t.result === 'SKIP').length,
    passed: gates.flatMap(g => g.tests).filter(t => t.result === 'PASS').length,
    failed: gates.flatMap(g => g.tests).filter(t => t.result === 'FAIL').length },
  execution: { exitCode: gates.some(g => g.tests.some(t => t.result === 'FAIL')) ? 1 : 0 }, gates });
const clone = value => structuredClone(value);

test('host context retains a requirement beyond character 700 while prompt input stays bounded', () => {
  assert.ok(taskText.indexOf(late) > 700);
  const trusted = validateControllerContext(context(), '04');
  const engine = new PiSitterEngine('active');
  engine.setTask(trusted.originalTask.text, '04');
  assert.ok(engine.task.includes(late));
  assert.equal(trusted.originalTask.requirements[1].text, late);
  assert.equal(normalizeGateReport(run(), trusted).gates[1].requirement, late);
});

test('mandatory A+B cannot be replaced by A or development test rows', () => {
  const trusted = validateControllerContext(context(), '04');
  assert.throws(() => normalizeGateReport(run([row('A')]), trusted), /missing expected gate/);
  assert.throws(() => normalizeGateReport(run([row('A'), { id: 'B', tests: [{ id: 'development-B', result: 'PASS', evidence: 'pass' }] }]), trusted),
    /unknown|malformed/);
  assert.equal(decideCompletion(normalizeGateReport(run(), trusted)).decision, 'UNVERIFIED');
  assert.equal(decideCompletion(normalizeGateReport(run([row('A'), row('B', 'FAIL')]), trusted)).decision, 'RECOVERY_REQUIRED');
  assert.equal(decideCompletion(normalizeGateReport(run([row('A'), row('B', 'SKIP')]), trusted)).decision, 'UNVERIFIED');
});

test('task, suite, source, duplicate, unknown and caller criteria changes fail closed', () => {
  const trusted = validateControllerContext(context(), '04');
  for (const [mutate, expected] of [
    [v => { v.taskId = 'other'; }, /task/],
    [v => { v.stage = '05'; }, /stage/],
    [v => { v.snapshotIdentity = 'b'.repeat(64); }, /source/],
    [v => { v.suite.digest = 'b'.repeat(64); }, /suite/],
    [v => { v.gates = [row('A'), row('A')]; }, /duplicate/],
    [v => { v.gates = [row('A'), row('C')]; }, /unknown/],
    [v => { v.gates[0].tests[0].id = 'development-A'; }, /unknown|malformed/],
    [v => { v.gates[0].requirement = 'unsafe caller criterion'; }, /unknown gate/],
  ]) {
    const candidate = clone(run());
    mutate(candidate);
    assert.throws(() => normalizeGateReport(candidate, trusted), expected);
  }
  const duplicate = context(); duplicate.originalTask.requirements.push(duplicate.originalTask.requirements[0]);
  assert.throws(() => validateControllerContext(duplicate, '04'), /Duplicate requirement/);
  const duplicateTest = context(); duplicateTest.suite.gates[1].testIds = ['scored-A'];
  assert.throws(() => validateControllerContext(duplicateTest, '04'), /Duplicate/);
  const missingTest = run(); missingTest.gates[0].tests = [];
  assert.throws(() => normalizeGateReport(missingTest, trusted), /missing expected test/);
  const oversized = run(); oversized.gates[0].tests[0].evidence = 'x'.repeat(1024 * 1024);
  assert.throws(() => normalizeGateReport(oversized, trusted), /oversized/);
  assert.throws(() => normalizeGateReport(run(), trusted, normalizeGateReport(run(), trusted)), /stale run identity/);
  const spoofed = run(); spoofed.testCounts.passed = 99;
  assert.throws(() => normalizeGateReport(spoofed, trusted), /spoofed test counts/);
  assert.throws(() => validateControllerContext(context(), '05'), /task, stage/);
  assert.throws(() => validateControllerContext({ ...context(), originalTask: { ...context().originalTask, text: 'x'.repeat(65537) } }, '04'), /oversized/);
});

test('legacy v1 passing history cannot authorize current VERIFIED', () => {
  assert.equal(decideCompletion({ schemaVersion: 1, stage: '04', snapshotIdentity: sha,
    gates: [{ id: 'A', result: 'PASS' }], counts: { PASS: 1, FAIL: 0, UNVERIFIED: 0 } }).decision, 'UNVERIFIED');
});

function extension(branch = [], load = () => context(), verify = async () => run()) {
  process.env.PI_SITTER_STAGE = '04';
  process.env.PI_SITTER_MODE = 'shadow';
  const handlers = new Map(), commands = new Map(), entries = [...branch];
  const pi = { on: (name, handler) => handlers.set(name, handler), registerCommand: (name, command) => commands.set(name, command), registerEntryRenderer() {},
    registerMessageRenderer() {}, getActiveTools: () => [], appendEntry: (customType, data) => entries.push({ type: 'custom', customType, data }) };
  const ctx = { cwd: '/fixture', hasUI: false, isIdle: () => true,
    sessionManager: { getBranch: () => entries, getSessionId: () => 's1' },
    ui: { setStatus() {}, setWidget() {}, setWorkingMessage() {}, setWorkingVisible() {}, notify() {} } };
  createPiSitter({ loadControllerContext: load, verify })(pi);
  handlers.get('session_start')({}, ctx);
  return { entries, handlers, commands, ctx };
}

test('host inventory survives follow-up and session reload without accepting a worker task override', async () => {
  const first = extension();
  first.handlers.get('before_agent_start')({ messageType: 'user', prompt: 'short follow-up' }, first.ctx);
  assert.equal(first.entries.filter(entry => entry.customType === 'pi-sitter-task-history').length, 0);
  const second = extension(first.entries);
  second.handlers.get('before_agent_start')({ messageType: 'user', prompt: 'another follow-up' }, second.ctx);
  const identities = second.entries.filter(entry => entry.customType === 'pi-sitter-controller-inventory');
  assert.equal(identities.at(-1).data.taskId, 'task-1');
  assert.equal(identities.at(-1).data.suiteDigest, sha);
  assert.equal(identities.at(-1).data.originalTask, undefined);
  await second.commands.get('sitter').handler('verify', second.ctx);
  const saved = second.entries.find(entry => entry.customType === 'pi-sitter-verification');
  assert.equal(saved.data.gates[1].requirement, late);
  assert.equal(second.entries.find(entry => entry.customType === 'pi-sitter-completion').data.decision, 'UNVERIFIED');
});

test('task switch clears old report and rejects evidence for the former task', async () => {
  let current = context();
  const h = extension([], () => current);
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.equal(h.entries.find(entry => entry.customType === 'pi-sitter-verification').data.taskId, 'task-1');
  current = { ...context(), taskId: 'task-2' };
  h.handlers.get('before_agent_start')({ messageType: 'user', prompt: 'new task' }, h.ctx);
  await h.commands.get('sitter').handler('report', h.ctx);
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-verification').length, 1);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-completion').at(-1).data.decision, 'BLOCKED');
  current = undefined;
  h.handlers.get('before_agent_start')({ messageType: 'user', prompt: 'controller unavailable' }, h.ctx);
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-completion').at(-1).data.decision, 'BLOCKED');
});

test('missing controller inventory blocks before invoking the verifier', async () => {
  let calls = 0;
  const h = extension([], () => undefined, async () => { calls++; return run(); });
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.equal(calls, 0);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-completion').at(-1).data.decision, 'BLOCKED');
});

test('controller inventory drift during verification blocks the run', async () => {
  let current = context();
  const h = extension([], () => current, async () => {
    current = { ...context(), originalTask: { ...context().originalTask,
      text: `${taskText} New controller requirement.`,
      requirements: [...context().originalTask.requirements, { id: 'R3', text: 'New controller requirement.' }] } };
    return run();
  });
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-verification').length, 0);
  assert.match(h.entries.filter(entry => entry.customType === 'pi-sitter-completion').at(-1).data.reason, /changed during verification/);
});

test('invalid injected report is blocked before persistence or recovery', async () => {
  const invalid = run(); invalid.testCounts.passed = 99;
  const h = extension([], () => context(), async () => invalid);
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-verification').length, 0);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-recovery').length, 0);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-completion').at(-1).data.decision, 'BLOCKED');
});
