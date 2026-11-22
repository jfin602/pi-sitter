import test from 'node:test';
import assert from 'node:assert/strict';
import { createPiSitter } from '../src/index.ts';
import { decideCompletion, createRecoveryPlan } from '../src/completion.ts';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

function report(stage, snapshot, results, regressions = []) {
  const gates = results.map(([id, result, fact = 'main.script']) => ({ id, result, fromStage: stage,
    requirement: id === 'REQ-MAIN-SCRIPT' ? 'Main scene gameplay controller attachment' : `Requirement for ${id}`,
    source: { path: 'prompt.md', line: 1, promptSha256: 'a'.repeat(64), sourcePrompt: 'Prompt' },
    method: { kind: 'evidence_fact', fact }, evidence: result === 'PASS' ? 'Saved artifact verified' :
      id === 'REQ-MAIN-SCRIPT' ? 'src/main.ts exists and parses, but the saved Main root has no script attached' : 'Observed runtime behavior is missing',
    explanation: result === 'UNVERIFIED' ? 'Probe unavailable' : '' }));
  const counts = { PASS: 0, FAIL: 0, UNVERIFIED: 0 };
  for (const gate of gates) counts[gate.result]++;
  return { schemaVersion: 2, taskId: 'task-04', stage,
    runId: 'run-04',
    snapshotIdentity: snapshot === 'unavailable' || /^[a-f0-9]{64}$/.test(snapshot) ? snapshot : createHash('sha256').update(snapshot).digest('hex'),
    snapshotFiles: 7, source: 'reviewed', suite: { id: 'suite-04', version: 'v1', digest: 'f'.repeat(64) },
    counts, testCounts: { executed: counts.PASS + counts.FAIL, skipped: counts.UNVERIFIED, passed: counts.PASS, failed: counts.FAIL },
    execution: { exitCode: counts.FAIL > 0 ? 1 : 0 }, gates: gates.map(gate => ({ ...gate, tests: [{ id: `scored-${gate.id}`, result: gate.result === 'UNVERIFIED' ? 'SKIP' : gate.result,
      evidence: gate.evidence }] })), regressions,
    missingDeliverables: gates.filter(g => g.result === 'FAIL').map(g => g.id), validationLimitations: [] };
}

function harness({ mode = 'active', reports = [], branch = [], analyze, shouldAnalyze, evidenceBroker, completionReady } = {}) {
  process.env.PI_SITTER_MODE = mode;
  process.env.PI_SITTER_STAGE = '04';
  const handlers = new Map(), commands = new Map(), entryRenderers = new Map(), entries = [...branch], notices = [], sent = [], working = [];
  let index = 0;
  let currentReport;
  let justRan = false;
  const known = [...reports.filter(value => value && typeof value === 'object' && !('then' in value)),
    ...branch.filter(entry => entry.customType === 'pi-sitter-verification').map(entry => entry.data)];
  const gateCatalog = new Map(known.flatMap(value => value.gates ?? []).map(gate => [gate.id, gate.requirement]));
  if (gateCatalog.size === 0) gateCatalog.set('A', 'Requirement for A');
  const controller = () => {
    const candidate = reports[Math.min(index, reports.length - 1)];
    const selected = justRan ? currentReport : candidate && typeof candidate === 'object' && 'snapshotIdentity' in candidate ? candidate : currentReport ?? known[0];
    justRan = false;
    const requirements = [...gateCatalog].map(([id, text]) => ({ id, text }));
    return { schemaVersion: 1, taskId: 'task-04', stage: '04',
      originalTask: { text: requirements.map(row => row.text).join('\n'), reference: 'test-controller:04', version: 'v1', requirements },
      suite: { id: 'suite-04', version: 'v1', digest: 'f'.repeat(64),
        gates: requirements.map(row => ({ id: row.id, requirementIds: [row.id], testIds: [`scored-${row.id}`] })) },
      sourceSnapshot: selected?.snapshotIdentity ?? 'a'.repeat(64) };
  };
  const pi = { on(name, fn) { const old = handlers.get(name); handlers.set(name, old ? async (...args) => {
    await old(...args); return fn(...args);
  } : fn); }, registerCommand(name, command) { commands.set(name, command); }, registerEntryRenderer(name, renderer) { entryRenderers.set(name, renderer); },
    registerMessageRenderer() {}, getActiveTools: () => [], appendEntry(customType, data) {
      entries.push({ type: 'custom', customType, data });
    }, sendMessage(message, options) { sent.push({ message, options }); } };
  const ctx = { hasUI: true, cwd: '/fixture', isIdle: () => true,
    sessionManager: { getBranch: () => entries, getSessionId: () => 'session-one' },
    ui: { theme: { fg: (_token, text) => text }, setStatus() {}, setWidget() {},
      setWorkingMessage(message) { working.push(['message', message]); },
      setWorkingVisible(visible) { working.push(['visible', visible]); },
      notify(message, level) { notices.push([message, level]); } } };
  createPiSitter({ verify: async (_stage, _root, options) => {
    if (options.signal?.aborted) throw Error('aborted');
    const value = await reports[Math.min(index++, reports.length - 1)];
    if (value instanceof Error) throw value;
    currentReport = value;
    justRan = true;
    return { schemaVersion: 2, taskId: value.taskId, runId: randomUUID(), stage: value.stage,
      snapshotIdentity: value.snapshotIdentity, suite: value.suite, testCounts: value.testCounts, execution: value.execution,
      gates: value.gates.map(gate => ({ id: gate.id, tests: gate.tests })) };
  }, loadControllerContext: controller, analyze, shouldAnalyze, evidenceBroker, completionReady })(pi);
  handlers.get('session_start')({}, ctx);
  const settle = (outcome = 'completed') => handlers.get('agent_before_settle')({ outcome, entries: [], continue: false }, ctx);
  const workerFinish = () => handlers.get('turn_end')({ outcome: 'completed', entries: [], toolResults: [],
    message: { role: 'assistant', content: [{ type: 'text', text: 'Repair attempt finished.' }], stopReason: 'stop' } }, ctx);
  return { pi, ctx, handlers, commands, entryRenderers, entries, notices, sent, working, settle, workerFinish };
}

test('completion decision requires every gate to pass and blocks unavailable snapshots', () => {
  assert.equal(decideCompletion(report('04', 'a'.repeat(64), [['A', 'PASS']])).decision, 'UNVERIFIED');
  assert.equal(decideCompletion(report('04', 'a'.repeat(64), [['A', 'PASS'], ['B', 'FAIL']])).decision, 'RECOVERY_REQUIRED');
  assert.equal(decideCompletion(report('04', 'a'.repeat(64), [['A', 'PASS'], ['B', 'UNVERIFIED']])).decision, 'UNVERIFIED');
  assert.equal(decideCompletion(report('04', 'unavailable', [['A', 'UNVERIFIED']])).decision, 'BLOCKED');
  const inconsistent = report('04', 'a'.repeat(64), [['A', 'FAIL']]);
  inconsistent.counts = { PASS: 1, FAIL: 0, UNVERIFIED: 0 };
  assert.equal(decideCompletion(inconsistent).decision, 'BLOCKED');
});

test('all passing tests remain UNVERIFIED until independent requirement review', async () => {
  const h = harness({ reports: [report('04', 'a'.repeat(64), [['A', 'PASS']])] });
  assert.equal(await h.settle(), undefined);
  assert.equal(h.entries.find(e => e.customType === 'pi-sitter-completion').data.decision, 'UNVERIFIED');
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-recovery').length, 0);
});

test('completion shows a gray pending transcript card and keeps the composer working until the final card', async () => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const h = harness({ reports: [delayed] });
  const settlement = h.settle();
  await new Promise(resolve => setImmediate(resolve));
  const pending = h.entries.find(e => e.customType === 'pi-sitter-verification-pending');
  assert.ok(pending);
  const theme = { appearance: 'dark', style(text) { return text; } };
  const pendingRenderer = h.entryRenderers.get('pi-sitter-verification-pending');
  assert.equal(pendingRenderer(pending, { expanded: false }, theme).render(80)[3].trim(), 'VERIFYING');
  assert.deepEqual(h.working.slice(0, 2), [['message', 'Pi Sitter verifying…'], ['visible', true]]);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-completion').length, 0);

  release(report('04', 'a'.repeat(64), [['A', 'PASS']]));
  assert.equal(await settlement, undefined);
  assert.equal(pendingRenderer(pending, { expanded: false }, theme).render(80)[3].trim(), 'UNVERIFIED');
  const completion = h.entries.find(e => e.customType === 'pi-sitter-completion');
  assert.equal(completion.data.displayId, pending.data.id);
  assert.equal(h.entryRenderers.get('pi-sitter-completion')(completion, { expanded: false }, theme), undefined);
  await h.handlers.get('agent_settled')({ aborted: false }, h.ctx);
  assert.deepEqual(h.working.slice(-2), [['visible', false], ['visible', true]]);

  const resumed = harness({ reports: [], branch: h.entries });
  const restored = resumed.entryRenderers.get('pi-sitter-verification-pending');
  assert.equal(restored(pending, { expanded: false }, theme).render(80)[3].trim(), 'UNVERIFIED');
});

test('manual verify shows its pending card before returning the final result', async () => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const h = harness({ reports: [delayed] });
  const command = h.commands.get('sitter').handler('verify', h.ctx);
  await new Promise(resolve => setImmediate(resolve));
  const pending = h.entries.find(e => e.customType === 'pi-sitter-verification-pending');
  const theme = { appearance: 'dark', style(text) { return text; } };
  const render = h.entryRenderers.get('pi-sitter-verification-pending');
  assert.equal(render(pending, { expanded: false }, theme).render(80)[3].trim(), 'VERIFYING');
  release(report('04', 'a'.repeat(64), [['A', 'PASS']]));
  await command;
  assert.equal(render(pending, { expanded: false }, theme).render(80)[3].trim(), 'UNVERIFIED');
  assert.deepEqual(h.working.slice(-3), [['message', undefined], ['visible', false], ['visible', true]]);
});

test('qualification can block recovery until a real Worker tool result exists', async () => {
  const readiness = names => names.includes('project_health_check') ? undefined : 'No project result';
  const h = harness({ reports: [report('04', 'a'.repeat(64), [['A', 'FAIL']])], completionReady: readiness });
  assert.equal(await h.settle(), undefined);
  assert.equal(h.entries.find(e => e.customType === 'pi-sitter-completion').data.decision, 'BLOCKED');
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-verification').length, 0);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-recovery').length, 0);
  await h.handlers.get('tool_execution_end')({ toolCallId: 'health', toolName: 'project_health_check',
    result: { content: [{ type: 'text', text: '{"ok":true}' }] }, isError: false, durationMs: 1 }, h.ctx);
  assert.equal((await h.settle()).continue, true);
});

test('missing attachment and failed runtime behavior produce evidence-backed targeted recovery', async () => {
  const r = report('04', 'b'.repeat(64), [['REQ-MAIN-SCRIPT', 'FAIL'], ['REQ-PLAYER-MOVEMENT', 'FAIL', 'player.movement'], ['OK', 'PASS']]);
  const h = harness({ reports: [r] });
  const boundary = await h.settle();
  assert.equal(boundary.continue, true);
  assert.equal(boundary.entries.filter(e => e.type === 'custom_message').length, 1);
  assert.equal(boundary.entries.find(e => e.type === 'custom_message').display, false);
  const text = boundary.entries.find(e => e.type === 'custom_message').content;
  assert.match(text, /REQ-MAIN-SCRIPT/);
  assert.match(text, /src\/main.ts exists and parses/);
  assert.match(text, /Preserve all functionality whose gates passed/);
  assert.match(text, /Do not rewrite unrelated files/);
  assert.equal(h.entries.find(e => e.customType === 'pi-sitter-completion').data.decision, 'RECOVERY_REQUIRED');
});

test('partial completion and unverified-only completion cannot be VERIFIED', async () => {
  const partial = harness({ reports: [report('04', 'c'.repeat(64), [['A', 'PASS'], ['B', 'FAIL'], ['C', 'UNVERIFIED']])] });
  await partial.settle();
  assert.equal(partial.entries.find(e => e.customType === 'pi-sitter-completion').data.decision, 'RECOVERY_REQUIRED');
  const uncertain = harness({ reports: [report('04', 'd'.repeat(64), [['A', 'PASS'], ['B', 'UNVERIFIED']])] });
  assert.equal(await uncertain.settle(), undefined);
  assert.equal(uncertain.entries.find(e => e.customType === 'pi-sitter-completion').data.decision, 'UNVERIFIED');
});

test('successful repair rerun remains UNVERIFIED pending requirement review', async () => {
  const h = harness({ reports: [report('04', 'e'.repeat(64), [['A', 'FAIL']]),
    report('04', 'f'.repeat(64), [['A', 'PASS']])] });
  assert.equal((await h.settle()).continue, true);
  assert.equal(await h.settle(), undefined);
  assert.deepEqual(h.entries.filter(e => e.customType === 'pi-sitter-completion').map(e => e.data.decision),
    ['RECOVERY_REQUIRED', 'UNVERIFIED']);
});

test('recovery regression is named and two attempts are the maximum', async () => {
  const h = harness({ reports: [report('04', 'g'.repeat(64), [['A', 'FAIL'], ['B', 'PASS']]),
    report('04', 'h'.repeat(64), [['A', 'FAIL'], ['B', 'FAIL']], ['B']),
    report('04', 'i'.repeat(64), [['A', 'FAIL'], ['B', 'FAIL']], ['B'])] });
  assert.equal((await h.settle()).continue, true);
  const second = await h.settle();
  assert.equal(second.continue, true);
  assert.match(second.entries.find(e => e.type === 'custom_message').content, /Regressed gate IDs: B/);
  assert.equal(await h.settle(), undefined);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-completion').at(-1).data.decision, 'RECOVERY_REQUIRED');
});

test('a user repair turn starts a fresh bounded recovery cycle, including after resume', async () => {
  const failed = report('04', 'v'.repeat(64), [['A', 'FAIL'], ['B', 'UNVERIFIED']]);
  const h = harness({ reports: [failed,
    report('04', 'w'.repeat(64), [['A', 'FAIL'], ['B', 'UNVERIFIED']]),
    report('04', 'x'.repeat(64), [['A', 'FAIL'], ['B', 'UNVERIFIED']]),
    report('04', 'y'.repeat(64), [['A', 'PASS'], ['B', 'FAIL']])] });
  assert.equal((await h.settle()).continue, true);
  assert.equal((await h.settle()).continue, true);
  assert.equal(await h.settle(), undefined);
  const prior = [...h.entries, { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'Repair B' }] } }];
  await h.handlers.get('before_agent_start')({ messageType: 'user', prompt: 'Repair B' }, h.ctx);
  const next = await h.settle();
  assert.equal(next.continue, true);
  assert.equal(next.entries.find(e => e.customType === 'pi-sitter-recovery').data.attempt, 1);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-verification-attempt').at(-1).data.attempt, 1);

  const resumed = harness({ reports: [report('04', 'z'.repeat(64), [['A', 'PASS'], ['B', 'FAIL']])], branch: prior });
  const afterResume = await resumed.settle();
  assert.equal(afterResume.continue, true);
  assert.equal(afterResume.entries.find(e => e.customType === 'pi-sitter-recovery').data.attempt, 1);
  assert.equal(resumed.entries.filter(e => e.customType === 'pi-sitter-verification-attempt').at(-1).data.attempt, 1);
});

test('unchanged saved snapshot gets one focused retry of the same repair attempt', async () => {
  const unchanged = report('04', 'p'.repeat(64), [['A', 'FAIL']]);
  const changed = report('04', 'q'.repeat(64), [['A', 'FAIL']]);
  const passed = report('04', 'r'.repeat(64), [['A', 'PASS']]);
  const h = harness({ reports: [unchanged, unchanged, changed, passed] });
  const first = await h.settle();
  assert.equal(first.entries.find(e => e.customType === 'pi-sitter-recovery').data.attempt, 1);
  await h.workerFinish();
  const retry = await h.settle();
  const retryRecord = retry.entries.find(e => e.customType === 'pi-sitter-recovery').data;
  assert.equal(retryRecord.attempt, 1);
  assert.equal(retryRecord.retry, 1);
  assert.match(retry.entries.find(e => e.type === 'custom_message').content, /previous repair turn ended without a saved project change/);
  assert.match(retry.entries.find(e => e.type === 'custom_message').content, /cause remains UNVERIFIED/);
  await h.workerFinish();
  const second = await h.settle();
  assert.equal(second.entries.find(e => e.customType === 'pi-sitter-recovery').data.attempt, 2);
  await h.workerFinish();
  assert.equal(await h.settle(), undefined);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-completion').at(-1).data.decision, 'UNVERIFIED');
});

test('repeated unchanged snapshot stops after one retry without an unbounded loop', async () => {
  const unchanged = report('04', 's'.repeat(64), [['A', 'FAIL']]);
  const h = harness({ reports: [unchanged] });
  assert.equal((await h.settle()).continue, true);
  await h.workerFinish();
  assert.equal((await h.settle()).continue, true);
  await h.workerFinish();
  assert.equal(await h.settle(), undefined);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-verification-attempt').length, 3);
});

test('resumed empty Worker turn retries once and restores that retry limit', async () => {
  const unchanged = report('04', 't'.repeat(64), [['A', 'FAIL']]);
  const initial = harness({ reports: [unchanged] });
  const first = await initial.settle();
  const recovery = first.entries.find(e => e.customType === 'pi-sitter-recovery');
  const branch = [...initial.entries, recovery, { type: 'message', message: { role: 'assistant', content: [] } }];
  const resumed = harness({ reports: [unchanged], branch });
  const retry = await resumed.settle();
  assert.equal(retry.entries.find(e => e.customType === 'pi-sitter-recovery').data.retry, 1);
  const retriedBranch = [...resumed.entries, retry.entries.find(e => e.customType === 'pi-sitter-recovery'),
    { type: 'message', message: { role: 'assistant', content: [] } }];
  const resumedAgain = harness({ reports: [unchanged], branch: retriedBranch });
  assert.equal(await resumedAgain.settle(), undefined);
});

test('each manual recover resets the attempt and verification limits, including after resume', async () => {
  const unchanged = report('04', 'u'.repeat(64), [['A', 'FAIL']]);
  const initial = harness({ reports: [unchanged] });
  const first = await initial.settle();
  const recorded = initial.entries.filter(e => e.customType !== 'pi-sitter-verification-attempt');
  const branch = [
    ...Array.from({ length: 5 }, () => ({ type: 'custom', customType: 'pi-sitter-verification-attempt',
      data: { stage: '04', attempt: 1 } })),
    ...recorded,
    first.entries.find(e => e.customType === 'pi-sitter-recovery'),
    { type: 'message', message: { role: 'assistant', content: [] } },
  ];
  const h = harness({ reports: [unchanged], branch });
  await h.commands.get('sitter').handler('recover', h.ctx);
  await h.commands.get('sitter').handler('status', h.ctx);
  assert.match(h.notices.at(-1)[0], /verification 0 ms \(0\/5\); recovery 1\/2/);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].message.content, /Next safe inspection:/);
  const recovery = h.entries.filter(e => e.customType === 'pi-sitter-recovery').at(-1).data;
  assert.equal(recovery.attempt, 1);
  assert.equal(recovery.retry, undefined);
  const request = h.entries.find(e => e.customType === 'pi-sitter-recovery-request');
  const theme = { appearance: 'dark', style(text) { return text; } };
  const render = h.entryRenderers.get('pi-sitter-recovery-request');
  assert.equal(render(request, { expanded: false }, theme).render(80)[3].trim(), 'RECOVERY_QUEUED');
  assert.equal(h.entryRenderers.get('pi-sitter-recovery')({ data: recovery }, { expanded: false }, theme), undefined);
  await h.commands.get('sitter').handler('recover', h.ctx);
  assert.equal(h.sent.length, 2);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-recovery').at(-1).data.attempt, 1);
  const resumed = harness({ reports: [unchanged], branch: h.entries });
  await resumed.commands.get('sitter').handler('status', resumed.ctx);
  assert.match(resumed.notices.at(-1)[0], /verification 0 ms \(0\/5\); recovery 1\/2/);
  assert.equal(resumed.entryRenderers.get('pi-sitter-recovery-request')(
    request, { expanded: false }, theme).render(80)[3].trim(), 'RECOVERY_QUEUED');
  await resumed.commands.get('sitter').handler('recover', resumed.ctx);
  assert.equal(resumed.sent.length, 1);
  assert.equal(resumed.entries.filter(e => e.customType === 'pi-sitter-recovery').at(-1).data.attempt, 1);
});

test('missing gate contract records BLOCKED; shadow mode reports without steering', async () => {
  const blocked = harness({ reports: [new Error('gate manifest 04 integrity failure')] });
  await blocked.settle();
  assert.equal(blocked.entries.find(e => e.customType === 'pi-sitter-completion').data.decision, 'BLOCKED');
  const shadow = harness({ mode: 'shadow', reports: [report('04', 'j'.repeat(64), [['A', 'FAIL']])] });
  assert.equal(await shadow.settle(), undefined);
  assert.equal(shadow.entries.filter(e => e.customType === 'pi-sitter-recovery').length, 0);
});

test('resume restores attempts and avoids duplicate recovery for the same snapshot', async () => {
  const first = harness({ reports: [report('04', 'k'.repeat(64), [['A', 'FAIL']])] });
  const boundary = await first.settle();
  const recovery = boundary.entries.find(e => e.type === 'custom').data;
  const resumed = harness({ reports: [report('04', 'k'.repeat(64), [['A', 'FAIL']])],
    branch: [...first.entries, { type: 'custom', customType: 'pi-sitter-recovery', data: recovery }] });
  assert.equal(await resumed.settle(), undefined);
  assert.equal(resumed.entries.filter(e => e.customType === 'pi-sitter-recovery').length, 1);
});

test('manual recover queues a supported current-session message and reports pending delivery', async () => {
  const h = harness({ mode: 'shadow', reports: [report('04', 'l'.repeat(64), [['A', 'FAIL']])] });
  await h.settle();
  await h.commands.get('sitter').handler('recover', h.ctx);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].options.triggerTurn, true);
  assert.match(h.notices.at(-1)[0], /queued.*delivery is pending/);
});

test('Pi commands show gate evidence, decision, and verification timing', async () => {
  const h = harness({ mode: 'shadow', reports: [report('04', 'n'.repeat(64), [['A', 'PASS'], ['B', 'FAIL']])] });
  await h.settle();
  await h.commands.get('sitter').handler('gates', h.ctx);
  assert.match(h.notices.at(-1)[0], /B: FAIL/);
  await h.commands.get('sitter').handler('report', h.ctx);
  assert.match(h.notices.at(-1)[0], /Unresolved gates:\nB FAIL: scored-B: Observed runtime behavior is missing/);
  await h.commands.get('sitter').handler('status', h.ctx);
  assert.match(h.notices.at(-1)[0], /verification \d+ ms \(1\/5\); recovery 0\/2/);
});

test('aborted completion and user cancellation do not deliver recovery', async () => {
  const h = harness({ reports: [report('04', 'm'.repeat(64), [['A', 'FAIL']])] });
  assert.equal(await h.settle('aborted'), undefined);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-verification').length, 0);
  await h.commands.get('sitter').handler('off', h.ctx);
  assert.equal(await h.settle(), undefined);
  assert.equal(h.entries.filter(e => e.customType === 'pi-sitter-recovery').length, 0);
});
