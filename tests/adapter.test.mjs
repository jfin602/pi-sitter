import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Container } from '@earendil-works/pi-tui';
import { createPiSitter } from '../src/index.ts';
import { piSitterLimits } from '../src/config.ts';
import { PiSitterEngine, classifyObservation } from '../src/core.ts';
import { installedPiSitterVersion } from '../src/test-discovery.ts';
const validators = { '04': () => 'Saved configuration is incomplete' };

const diagnosis = { issue: 'Preload path is invalid', evidence: 'Invalid preload at line 3',
  next_action: 'Fix the preload string and parse the script again', confidence: 0.9, abstain: false };
const ready = { kind: 'ready', diagnosis, latencyMs: 12, inputTokens: 100, outputTokens: 40 };

function harness(mode = 'shadow', diagnose = async () => ready, branch = [], verify, extra = {}) {
  process.env.PI_SITTER_MODE = mode;
  const handlers = new Map(), commands = new Map(), entryRenderers = new Map(), messageRenderers = new Map(), entries = [...branch], statuses = [], widgets = [], notices = [], sent = [], working = [];
  const pi = { on(name, fn) { const previous = handlers.get(name); handlers.set(name, previous ? async (...args) => {
    const earlier = await previous(...args);
    return (await fn(...args)) ?? earlier;
  } : fn); }, registerCommand(name, value) { commands.set(name, value); },
    registerEntryRenderer(name, renderer) { entryRenderers.set(name, renderer); },
    registerMessageRenderer(name, renderer) { messageRenderers.set(name, renderer); },
    getActiveTools: () => ['project_scripts_get_parse_errors'],
    appendEntry(customType, data) { entries.push({ type: 'custom', customType, data }); },
    sendMessage(message, options) { sent.push({ message, options }); } };
  const ctx = { hasUI: true, cwd: '/unused', isIdle: () => true, sessionManager: { getBranch: () => entries, getSessionId: () => 'synthetic-session' },
    ui: { theme: { fg: (token, text) => `<${token}>${text}</${token}>` },
      setStatus: (key, value) => statuses.push([key, value]), setWidget: (key, value) => widgets.push([key, value]),
      setWorkingMessage(value) { working.push(value); }, setWorkingVisible() {},
      notify: (message, level) => notices.push([message, level]) } };
  createPiSitter({ diagnose, verify, milestoneValidators: validators, ...extra })(pi);
  handlers.get('session_start')({ type: 'session_start', reason: 'startup' }, ctx);
  return { pi, ctx, handlers, commands, entryRenderers, messageRenderers, entries, statuses, widgets, notices, sent, working };
}

test('completion uses stacked rows with theme-aware colors and emphasized status', () => {
  const h = harness();
  const render = h.entryRenderers.get('pi-sitter-completion');
  const entry = { data: { stage: '01', decision: 'VERIFIED', counts: { PASS: 9, FAIL: 0, UNVERIFIED: 0 },
    reason: 'Every required gate passed on the saved snapshot' } };
  for (const appearance of ['dark', 'light']) {
    const styles = [];
    const theme = { appearance, style(text, options) { styles.push({ text, ...options }); return text; } };
    const lines = render(entry, { expanded: false }, theme).render(80);
    assert.equal(lines.length, 7);
    assert.ok(lines.every(line => line.length === 80));
    assert.deepEqual(lines.map(line => line.trim()), ['', 'Pi Sitter', 'Stage 01', 'HISTORICAL', '',
      'Historical completion; current attempt requires fresh validated evidence', '']);
    assert.equal(styles[1].text.trim(), 'Pi Sitter');
    assert.equal(styles[1].bold, true);
    assert.deepEqual(styles[1].fg, appearance === 'dark' ? { kind: 'rgb', r: 200, g: 185, b: 217 } : 'accent');
    assert.deepEqual(styles[2].fg, appearance === 'dark' ? { kind: 'rgb', r: 238, g: 231, b: 245 } : 'text');
    assert.equal(styles[3].bold, true);
    assert.deepEqual(styles[3].fg, appearance === 'dark' ? { kind: 'rgb', r: 200, g: 185, b: 217 } : 'accent');
    assert.ok(styles.every(style => JSON.stringify(style.bg) === JSON.stringify(appearance === 'dark' ? { kind: 'rgb', r: 64, g: 51, b: 79 } : 'customMessageBg')));
  }
});

test('pending verification card is gray in dark and light themes', () => {
  const h = harness();
  const render = h.entryRenderers.get('pi-sitter-verification-pending');
  for (const [appearance, expected] of [['dark', [55, 55, 55]], ['light', [226, 226, 226]]]) {
    const styles = [];
    const theme = { appearance, style(text, options) { styles.push(options); return text; } };
    const rows = render({ data: { id: 'pending', stage: '05' } }, { expanded: false }, theme).render(80);
    assert.equal(rows[3].trim(), 'VERIFYING');
    assert.ok(styles.every(style => [style.bg.r, style.bg.g, style.bg.b].every((value, index) => value === expected[index])));
  }
});

test('a recover command has its own gray request card before the queued result', () => {
  const h = harness();
  const render = h.entryRenderers.get('pi-sitter-recovery-request');
  const styles = [];
  const theme = { appearance: 'dark', style(text, options) { styles.push(options); return text; } };
  const rows = render({ data: { id: 'request', stage: '05', reset: true } },
    { expanded: false }, theme).render(80);
  assert.equal(rows[3].trim(), 'RECOVERY_REQUESTED');
  assert.ok(styles.every(style => style.bg.r === 55 && style.bg.g === 55 && style.bg.b === 55));
});

test('unbound completion cards are explicitly historical', () => {
  const h = harness();
  const render = h.entryRenderers.get('pi-sitter-completion');
  const base = { stage: '05', counts: { PASS: 3, FAIL: 2, UNVERIFIED: 0 },
    failedGateIds: ['REQ-ITEM-AREA-CONNECTION', 'REQ-COLLISION-PHYSICAL'], unverifiedGateIds: [],
    reason: 'Two required gates failed' };
  const cases = [
    [{ ...base, decision: 'RECOVERY_REQUIRED', attempt: 0 }, 'HISTORICAL', [107, 63, 29]],
    [{ ...base, decision: 'RECOVERY_REQUIRED', attempt: 2 }, 'HISTORICAL', [106, 31, 31]],
    [{ ...base, decision: 'BLOCKED', attempt: 0 }, 'HISTORICAL', [106, 31, 31]],
    [{ ...base, decision: 'UNVERIFIED', counts: { PASS: 3, FAIL: 0, UNVERIFIED: 1 },
      unverifiedGateIds: ['REQ-VISUAL-CHECK'], attempt: 0 }, 'HISTORICAL', [106, 31, 31]],
  ];
  for (const [data, status, rgb] of cases) {
    const styles = [];
    const theme = { appearance: 'dark', style(text, options) { styles.push(options); return text; } };
    const rows = render({ data }, { expanded: false }, theme).render(80).map(line => line.trim());
    assert.deepEqual(rows.slice(1, 4), ['Pi Sitter', 'Stage 05', status]);
    assert.equal(rows[4], '');
    assert.ok(rows[5].length > 0);
    assert.ok(styles.every(style => style.bg.r === rgb[0] && style.bg.g === rgb[1] && style.bg.b === rgb[2]));
    assert.equal(styles[3].bold, true);
  }
  const styles = [];
  const theme = { appearance: 'light', style(text, options) { styles.push(options); return text; } };
  render({ data: cases[0][0] }, { expanded: false }, theme).render(80);
  assert.ok(styles.every(style => style.bg === 'customMessageBg'));
  assert.equal(styles[3].fg, 'warning');
  styles.length = 0;
  render({ data: cases[1][0] }, { expanded: false }, theme).render(80);
  assert.equal(styles[3].fg, 'error');
});

test('verification and recovery cards keep stage and state on separate rows', () => {
  const h = harness();
  const styles = [];
  const theme = { appearance: 'dark', style(text, options) { styles.push(options); return text; } };
  const report = { stage: '05', snapshotIdentity: 'a'.repeat(64), counts: { PASS: 3, FAIL: 1, UNVERIFIED: 0 },
    regressions: [], gates: [{ id: 'REQ-COLLISION-PHYSICAL', result: 'FAIL', evidence: 'Collision missing' }] };
  const verification = h.entryRenderers.get('pi-sitter-verification')({ data: report }, { expanded: true }, theme).render(80);
  assert.deepEqual(verification.slice(1, 6).map(line => line.trim()),
    ['Pi Sitter', 'Stage 05', 'HISTORICAL', '', 'Historical report; current attempt requires fresh validated evidence']);
  assert.ok(styles.every(style => style.bg.r === 106 && style.bg.g === 31 && style.bg.b === 31));
  styles.length = 0;
  const plan = { stage: '05', focusGateIds: ['REQ-COLLISION-PHYSICAL'], text: 'Pi Sitter Recovery — Stage 05\nCheck collision' };
  const recovery = h.entryRenderers.get('pi-sitter-recovery')({ data: { attempt: 1, plan, delivery: 'queued_manual' } },
    { expanded: true }, theme).render(80);
  assert.deepEqual(recovery.slice(1, 6).map(line => line.trim()),
    ['Pi Sitter', 'Stage 05', 'HISTORICAL', '', 'Historical recovery; no current repair is authorized by this entry']);
  assert.ok(styles.every(style => style.bg.r === 106 && style.bg.g === 31 && style.bg.b === 31));
  assert.ok(!recovery.some(line => line.includes(' | ') || line.includes(' · ')));
  const message = h.messageRenderers.get('pi-sitter-recovery-message')({ content: plan.text }, {}, theme).render(80);
  assert.deepEqual(message.slice(1, 4).map(line => line.trim()), ['Pi Sitter', 'Stage 05', 'RECOVERY_GUIDANCE']);
});

test('footer status is compact and entirely themed as muted text', () => {
  const h = harness('active');
  assert.equal(h.statuses.at(-1)[1], `<muted>Pi Sitter v${installedPiSitterVersion()} active | sleeping | 0 triggers</muted>`);
});

test('completion text wraps within the available terminal width', () => {
  const h = harness();
  const render = h.entryRenderers.get('pi-sitter-completion');
  const entry = { data: { stage: '03', decision: 'BLOCKED', reason: 'Verification failed because saved evidence is incomplete' } };
  const theme = { appearance: 'dark', style: text => text };
  const lines = render(entry, { expanded: false }, theme).render(24);
  assert.ok(lines.length > 3);
  assert.ok(lines.every(line => Array.from(line).length === 24));
  assert.match(lines.join(''), /Historical completion/);
});

function emitTool(h, id, text = '{"ok":false,"errors":[{"message":"Invalid preload at line 3"}]}') {
  const name = 'project_scripts_get_parse_errors';
  h.handlers.get('tool_execution_start')({ type: 'tool_execution_start', toolCallId: id, toolName: name,
    args: { script_path: 'res://src/main.ts' } }, h.ctx);
  const result = { content: [{ type: 'text', text }] };
  h.handlers.get('tool_execution_end')({ type: 'tool_execution_end', toolCallId: id, toolName: name,
    result, isError: false, durationMs: 2 }, h.ctx);
  return { role: 'toolResult', toolCallId: id, toolName: name, content: result.content, isError: false, timestamp: Date.now() };
}

function boundary(h, result, stopReason = 'toolUse') {
  return h.handlers.get('turn_end')({ type: 'turn_end', outcome: 'completed', entries: [], continue: false,
    message: { role: 'assistant', stopReason }, toolResults: [result] }, h.ctx);
}

test('Shadow records one outcome without opening the panel or injecting', async () => {
  const h = harness('shadow', async (_ctx, _input, _limits, _signal, onText) => {
    onText('{"issue":'); onText(JSON.stringify(diagnosis));
    await new Promise(r => setTimeout(r, 170));
    return ready;
  });
  emitTool(h, 'a'); const result = emitTool(h, 'b');
  assert.equal(h.entries.filter(x => x.customType === 'pi-sitter-event').length, 1);
  assert.equal(await boundary(h, result), undefined);
  assert.equal(h.entries.filter(x => x.customType === 'pi-sitter-outcome').length, 1);
  assert.equal(h.entries.find(x => x.customType === 'pi-sitter-outcome').data.kind, 'ready');
  assert.ok(h.statuses.some(([, value]) => value?.includes('streaming')));
  assert.ok(h.widgets.every(([, lines]) => !lines?.length));
  await h.commands.get('sitter').handler('status', h.ctx);
  assert.match(h.notices.at(-1)[0], /inference 1\/3;.*delivered 0;.*failed 0; budget 2; tokens 100\/40/);
});

test('accepted intervention renders muted immediately and completes the same warning card after a 10-second diagnosis', async () => {
  let finished = false;
  const h = harness('active', async () => {
    await new Promise(resolve => setTimeout(resolve, 10_000));
    finished = true;
    return ready;
  });
  emitTool(h, 'delayed-a');
  const start = performance.now();
  const result = emitTool(h, 'delayed-b');
  const task = boundary(h, result);
  const events = h.entries.filter(entry => entry.customType === 'pi-sitter-intervention');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.phase, 'started');
  assert.equal(finished, false);
  assert.equal(h.working.at(-1), 'Pi Sitter investigating…');
  assert.ok(performance.now() - start < 1000, 'pending event must precede supervisor completion');
  const renderer = h.entryRenderers.get('pi-sitter-intervention');
  const styles = [];
  const theme = { appearance: 'dark', style(text, options) { styles.push(options); return text; } };
  const pending = renderer(events[0], { expanded: false }, theme).render(80);
  assert.match(pending.join(''), /Investigating repeated tool failure/);
  assert.ok(styles.every(style => style.bg.r === 55 && style.bg.g === 55 && style.bg.b === 55));
  const delivery = await task;
  assert.equal(delivery.entries.length, 1);
  assert.equal(finished, true);
  assert.equal(h.working.at(-1), undefined);
  const terminal = h.entries.filter(entry => entry.customType === 'pi-sitter-intervention').at(-1);
  assert.equal(terminal.data.id, events[0].data.id);
  assert.equal(terminal.data.phase, 'completed');
  assert.equal(terminal.data.workerPrompt, delivery.entries[0].content);
  const clickable = renderer(events[0], { expanded: false }, theme);
  const collapsed = clickable.render(80).join('\n');
  assert.match(collapsed, /Click to show more/);
  assert.doesNotMatch(collapsed, /Full prompt supplied to Worker/);
  const hostContainer = new Container();
  hostContainer.addChild(clickable);
  hostContainer.render(80);
  const hintY = collapsed.split('\n').findIndex(line => line.includes('Click to show more'));
  const click = hostContainer.handleMouse({ type: 'click', button: 'left', x: 2, y: hintY,
    screenX: 2, screenY: hintY, width: 80, height: collapsed.split('\n').length });
  assert.equal(click?.handled, true);
  const opened = clickable.render(80).join('\n');
  assert.match(opened, /Full prompt supplied to Worker/);
  assert.match(opened, /\[Pi Sitter intervention — extension generated/);
  assert.match(opened, /Next: Fix the preload string/);
  assert.doesNotMatch(opened, /^ > /m);
  assert.equal(opened.match(/Full prompt supplied to Worker:/g)?.length, 1);
  assert.match(opened, /Click to show less/);
  assert.deepEqual(clickable.handleMouse({ type: 'click', button: 'left' }), { handled: true });
  assert.doesNotMatch(clickable.render(80).join('\n'), /Full prompt supplied to Worker/);
  styles.length = 0;
  const complete = renderer(events[0], { expanded: true }, theme).render(80);
  assert.match(complete.join(''), /Preload path is invalid/);
  assert.match(complete.join(''), /Fix the preload string/);
  assert.ok(styles.every(style => style.bg.r === 107 && style.bg.g === 63 && style.bg.b === 29));
  assert.match(complete.join('\n'), /GUIDANCE SUPPLIED — DELIVERY PENDING/);
  assert.equal(renderer(terminal, { expanded: false }, theme), undefined);
  assert.equal(h.entryRenderers.get('pi-sitter-outcome')(
    h.entries.find(entry => entry.customType === 'pi-sitter-outcome'), { expanded: false }, theme), undefined);
});

test('failed and cancelled supervision end the pending card', async () => {
  const failed = harness('active', async () => ({ kind: 'failed', reason: 'Supervisor unavailable', latencyMs: 3 }), [], undefined,
    { limits: { ...piSitterLimits(), maxFallbackAdvisories: 0 } });
  emitTool(failed, 'fail-a');
  await boundary(failed, emitTool(failed, 'fail-b'));
  const failure = failed.entries.filter(entry => entry.customType === 'pi-sitter-intervention');
  assert.deepEqual(failure.map(entry => entry.data.phase), ['started', 'failed']);
  const theme = { appearance: 'dark', style: (text) => text };
  assert.match(failed.entryRenderers.get('pi-sitter-intervention')(failure[0], { expanded: false }, theme).render(80).join(''), /Supervisor unavailable/);

  const cancelled = harness('active', (_ctx, _input, _limits, signal) => new Promise(resolve => {
    signal.addEventListener('abort', () => resolve({ kind: 'canceled', latencyMs: 1 }), { once: true });
  }));
  emitTool(cancelled, 'cancel-a');
  const pending = boundary(cancelled, emitTool(cancelled, 'cancel-b'));
  await cancelled.commands.get('sitter').handler('off', cancelled.ctx);
  await pending;
  assert.deepEqual(cancelled.entries.filter(entry => entry.customType === 'pi-sitter-intervention').map(entry => entry.data.phase),
    ['started', 'cancelled']);
});

test('rejected supervisor replies are quoted on demand and never labeled as Worker prompts', async () => {
  let calls = 0;
  const replies = ['{"issue":"First guess","evidence":"not in trigger"}',
    '{"issue":"Second guess","evidence":"still not in trigger"}\u001b[2J'];
  const h = harness('active', async () => ({ kind: 'failed', invalidOutput: true,
    reason: 'evidence is not grounded in the trigger', rawResponse: replies[calls++], latencyMs: 1 }),
    [], undefined, { limits: { ...piSitterLimits(), maxFallbackAdvisories: 0 } });
  emitTool(h, 'rejected-a');
  assert.equal(await boundary(h, emitTool(h, 'rejected-b')), undefined);
  assert.equal(calls, 2);
  const events = h.entries.filter(entry => entry.customType === 'pi-sitter-intervention');
  assert.deepEqual(events.at(-1).data.rejectedResponses, replies);
  assert.equal(events.at(-1).data.workerPrompt, undefined);
  const renderer = h.entryRenderers.get('pi-sitter-intervention');
  const theme = { appearance: 'dark', style: text => text };
  const card = renderer(events[0], { expanded: false }, theme);
  assert.match(card.render(120).join('\n'), /Click to show more/);
  assert.doesNotMatch(card.render(120).join('\n'), /First guess/);
  card.handleMouse({ type: 'click', button: 'left' });
  const expanded = card.render(120).join('\n');
  assert.match(expanded, /Rejected supervisor response 1 \(not sent to Worker\)/);
  assert.match(expanded, /\{"issue":"First guess"/);
  assert.match(expanded, /Rejected supervisor response 2 \(not sent to Worker\)/);
  assert.match(expanded, /\\u001b\[2J/);
  assert.doesNotMatch(expanded, /\u001b/);
  assert.doesNotMatch(expanded, /Full prompt supplied to Worker/);
  const restored = harness('active', async () => { throw Error('unexpected inference'); }, h.entries);
  const replayed = restored.entryRenderers.get('pi-sitter-intervention')(events[0], { expanded: true }, theme).render(120).join('\n');
  assert.match(replayed, /\{"issue":"Second guess"/);
});

test('ordinary Worker calls and passive monitoring create no intervention card', async () => {
  const h = harness('active');
  emitTool(h, 'single-failure');
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-intervention').length, 0);
  const off = harness('off');
  emitTool(off, 'off-a');
  await boundary(off, emitTool(off, 'off-b'));
  assert.equal(off.entries.filter(entry => entry.customType === 'pi-sitter-intervention').length, 0);
});

test('replayed intervention updates in place and unexpected terminal remains visible', () => {
  const original = harness('active');
  emitTool(original, 'replay-a');
  return boundary(original, emitTool(original, 'replay-b')).then(() => {
    const restored = harness('active', async () => { throw Error('should not diagnose'); }, original.entries);
    const entries = restored.entries.filter(entry => entry.customType === 'pi-sitter-intervention');
    const renderer = restored.entryRenderers.get('pi-sitter-intervention');
    const theme = { appearance: 'dark', style: text => text };
    assert.match(renderer(entries[0], { expanded: false }, theme).render(80).join(''), /Stop retrying project_scripts_get_parse_errors/);
    assert.equal(renderer(entries[1], { expanded: false }, theme), undefined);
    const orphan = { type: 'custom', customType: 'pi-sitter-intervention', data: {
      id: 'orphan', phase: 'completed', trigger: 'T1:orphan', stage: 'current', issue: 'Recovered result' } };
    const recovered = harness('active', async () => ready, [orphan, structuredClone(orphan)]);
    const orphanRenderer = recovered.entryRenderers.get('pi-sitter-intervention');
    assert.match(orphanRenderer(recovered.entries[0], { expanded: false }, theme).render(80).join(''), /Recovered result/);
    assert.equal(orphanRenderer(recovered.entries[1], { expanded: false }, theme), undefined);
    const interrupted = harness('active', async () => ready, [entries[0]]);
    assert.match(interrupted.entryRenderers.get('pi-sitter-intervention')(
      interrupted.entries[0], { expanded: false }, theme).render(80).join(''), /Supervision ended before a result/);
  });
});

test('Active delivers once at natural tool continuation and suppresses duplicate triggers', async () => {
  const h = harness('active');
  emitTool(h, 'a'); const result = emitTool(h, 'b');
  const delivery = await boundary(h, result);
  assert.equal(delivery.entries.length, 1);
  assert.equal(delivery.entries[0].type, 'custom_message');
  assert.equal(delivery.entries[0].display, false);
  assert.match(delivery.entries[0].content, /Pi Sitter intervention — extension generated, advisory/);
  assert.equal(delivery.continue, undefined);
  assert.equal(h.entries.filter(x => x.customType === 'pi-sitter-outcome').length, 1);
  assert.equal(h.entries.find(x => x.customType === 'pi-sitter-outcome').data.kind, 'delivered');
  emitTool(h, 'c'); const duplicate = emitTool(h, 'd');
  assert.equal(await boundary(h, duplicate), undefined);
  await h.commands.get('sitter').handler('status', h.ctx);
  assert.match(h.notices.at(-1)[0], /inference 1\/3;.*delivered 1/);
});

test('T4 includes the no-op receipt and recent Worker calls before Active delivery', async () => {
  let observed;
  const h = harness('active', async (_ctx, input) => {
    observed = input;
    return { kind: 'ready', diagnosis: { issue: 'Assignment made no change',
      evidence: 'receipt status updated; changes []', next_action: 'Inspect the saved scene and choose a different correction',
      confidence: 0.9, abstain: false }, latencyMs: 3 };
  });
  const name = 'project_scene_edit_set_node_property';
  const result = { content: [{ type: 'text', text: '{"ok":true,"receipt":{"status":"updated","changes":[]}}' }] };
  for (const id of ['a', 'b']) {
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name, args: { path: 'Player.shape', value: null } }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
  }
  const latest = { role: 'toolResult', toolCallId: 'b', toolName: name, content: result.content, isError: false };
  const delivery = await boundary(h, latest);
  assert.equal(observed.trigger.type, 'T4');
  assert.match(observed.recent.at(-1).result, /"changes":\[\]/);
  assert.equal(delivery.entries[0].customType, 'pi-sitter-advisory');
});

test('stage 04 unchanged scene-tree reads trigger one active inspection intervention', async () => {
  const h = harness('active', async () => ({ kind: 'failed', reason: 'Supervisor unavailable', latencyMs: 1 }));
  const name = 'mcp__godot__godot_inspection_get_scene_tree';
  const result = { content: [{ type: 'text', text: JSON.stringify({ tree: { name: 'meteor',
    type: 'Area2D', children: [{ name: 'Visual', type: 'Sprite2D' }] }, truncated: false }) }] };
  let latest;
  for (let n = 1; n <= 5; n++) {
    const id = `scene-${n}`;
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name, args: { lightweight: true } }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
    latest = { role: 'toolResult', toolCallId: id, toolName: name, content: result.content, isError: false };
    assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-event').length, n === 5 ? 1 : 0);
  }
  const delivery = await boundary(h, latest);
  assert.equal(h.entries.find(entry => entry.customType === 'pi-sitter-event').data.type, 'T5');
  assert.deepEqual(h.entries.filter(entry => entry.customType === 'pi-sitter-intervention').map(entry => entry.data.phase),
    ['started', 'completed']);
  assert.equal(delivery.entries[0].customType, 'pi-sitter-advisory');
  assert.match(delivery.entries[0].content, /Stop calling .*godot_inspection_get_scene_tree/);
  for (let n = 6; n <= 7; n++) {
    const id = `scene-${n}`;
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name, args: { lightweight: true } }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
  }
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-event').length, 1);
  assert.ok(h.notices.some(([message]) => message.includes('loop unresolved')));
});

test('weak inspection advice becomes a concrete Worker command and the card quotes it once', async () => {
  const weak = { issue: 'Worker is looping', evidence: '3 identical inspections of unchanged state during recovery',
    next_action: 'Inspect the expected scene structure and current scripts to determine the issue',
    confidence: 1, abstain: false };
  const h = harness('active', async () => ({ kind: 'ready', diagnosis: weak, latencyMs: 1 }));
  const emit = (name, id, args, body) => {
    const result = { content: [{ type: 'text', text: JSON.stringify(body) }] };
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name, args }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
    return { role: 'toolResult', toolCallId: id, toolName: name, content: result.content, isError: false };
  };
  emit('project_scripts_read', 'source', { script_path: 'src/main.ts' }, { content: 'saved source' });
  emit('project_scene_edit_save_scene', 'preview', { dry_run: true },
    { dry_run: true, saved: false, receipt: { status: 'noop', changes: [] } });
  let last;
  for (let i = 0; i < 3; i++) last = emit('project_scene_tree', `tree-${i}`, {}, { tree: { name: 'Main' } });
  const delivery = await boundary(h, last);
  const directive = delivery.entries[0].content;
  assert.match(directive, /Stop calling project_scene_tree with \{\}/);
  assert.match(directive, /Next: Read "src\/main.ts" with project_scripts_read/);
  assert.doesNotMatch(directive, /Inspect the expected scene structure/);
  const terminal = h.entries.filter(entry => entry.customType === 'pi-sitter-intervention').at(-1);
  assert.equal(terminal.data.workerPrompt, directive);
  assert.equal(terminal.data.source, 'fallback');
  assert.match(terminal.data.rejectedResponses[0], /Inspect the expected scene structure/);
  const renderer = h.entryRenderers.get('pi-sitter-intervention');
  const theme = { appearance: 'dark', style: text => text };
  const started = h.entries.find(entry => entry.customType === 'pi-sitter-intervention');
  const collapsed = renderer(started, { expanded: false }, theme).render(62).join('\n');
  assert.match(collapsed, /Stop calling project_scene_tree/);
  assert.match(collapsed, /Next: Read "src\/main.ts"/);
  const expanded = renderer(started, { expanded: true }, theme).render(62);
  assert.ok(expanded.every(row => Array.from(row).length === 62));
  assert.equal(expanded.filter(row => row.includes(' Next:')).length, 1);
  assert.match(expanded.join('\n'), /Worker directive \(expanded below\)/);
  assert.match(expanded.join('\n'), /Rejected supervisor response 1 \(not sent to Worker\)/);
  const wideRows = renderer(started, { expanded: true }, theme).render(1000);
  const quoteStart = wideRows.findIndex(row => row.includes('Full prompt supplied to Worker:'));
  const promptRows = [];
  for (const row of wideRows.slice(quoteStart + 1)) {
    if (!row.startsWith(' ')) break;
    if (row.includes(' Issue:')) break;
    promptRows.push(row);
  }
  const unwrapped = promptRows.map(row => row.slice(1).trimEnd()).join('\n');
  assert.match(unwrapped, /Stop calling project_scene_tree/);
  assert.doesNotMatch(unwrapped, /^ > /m);
  emit('project_scene_tree', 'post-1', {}, { tree: { name: 'Main' } });
  emit('project_scene_tree', 'post-2', {}, { tree: { name: 'Main' } });
  assert.ok(h.notices.some(([message]) => message.includes('loop unresolved')));
});

test('intervention labels an earlier host diagnostic stale after a saved update', async () => {
  const h = harness('active', async () => ({ kind: 'failed', reason: 'Supervisor unavailable', latencyMs: 1 }),
    [], undefined, { projectDiagnostic: async () => ({ status: 'FAIL', passed: 0, failed: 1, total: 1,
      failures: [{ id: 'saved-script', detail: 'Main script=missing' }] }) });
  const retry = await h.handlers.get('agent_before_settle')({ type: 'agent_before_settle',
    outcome: 'completed', entries: [], continue: false }, h.ctx);
  assert.match(retry.entries.at(-1).content, /saved-script: "Main script=missing"/);
  const emit = (name, id, args, body) => {
    const result = { content: [{ type: 'text', text: JSON.stringify(body) }] };
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name, args }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
    return { role: 'toolResult', toolCallId: id, toolName: name, content: result.content, isError: false };
  };
  emit('project_scene_edit_save_scene', 'saved', {}, { saved: true, dry_run: false,
    receipt: { status: 'updated', changes: [{ path: 'src/main.ts', op: 'set', before: null, after: null }] } });
  let last;
  for (let i = 0; i < 5; i++) last = emit('project_scene_tree', `stale-tree-${i}`, {}, { tree: { name: 'Main' } });
  const delivery = await boundary(h, last);
  assert.match(delivery.entries[0].content, /Earlier host diagnostic, before later saved changes/);
  assert.match(delivery.entries[0].content, /saved-script: Main script=missing/);
});

test('deterministic host diagnostics append ordered, historical terminal verdicts', async () => {
  const results = [
    { id: 'one', status: 'FAIL', suite: 'fixture', passed: 1, failed: 1, total: 2,
      failures: [{ id: 'G2', detail: 'Saved check failed' }] },
    { id: 'two', status: 'PASS', suite: 'fixture', passed: 2, failed: 0, total: 2 },
  ];
  const h = harness('shadow', async () => ready, [], undefined,
    { projectDiagnostic: async () => results.shift() });
  const event = { type: 'agent_before_settle', outcome: 'completed', entries: [], continue: false };
  await h.handlers.get('agent_before_settle')(event, h.ctx);
  const types = h.entries.map(row => row.customType);
  assert.ok(types.indexOf('pi-sitter-project-diagnostic-pending') < types.indexOf('pi-sitter-project-diagnostic'));
  assert.ok(types.indexOf('pi-sitter-project-diagnostic') < types.indexOf('pi-sitter-project-diagnostic-verdict'));
  const first = h.entries.find(row => row.customType === 'pi-sitter-project-diagnostic-verdict');
  assert.deepEqual(first.data.failedIds, ['G2']);
  await h.handlers.get('agent_before_settle')(event, h.ctx);
  const verdicts = h.entries.filter(row => row.customType === 'pi-sitter-project-diagnostic-verdict');
  assert.equal(verdicts.length, 2);
  const renderer = h.entryRenderers.get('pi-sitter-project-diagnostic-verdict');
  const theme = { appearance: 'dark', style: text => text };
  assert.match(renderer(verdicts[0], { expanded: false }, theme).render(100).join('\n'), /HISTORICAL/);
  assert.match(renderer(verdicts[1], { expanded: false }, theme).render(100).join('\n'), /Host validation passed: 2\/2 checks/);
  h.handlers.get('session_start')({ type: 'session_start', reason: 'resume' }, h.ctx);
  assert.equal(h.entries.filter(row => row.customType === 'pi-sitter-project-diagnostic-verdict').length, 2);
});

test('deterministic no-op fallback steers only Active mode and stops at its own advisory budget', async () => {
  const limits = { ...piSitterLimits(), maxInferenceAttempts: 1, maxValidAdvisories: 0, maxFallbackAdvisories: 1 };
  const emitNoop = (h, id, property) => {
    const name = 'project_scene_edit_set_node_property';
    const result = { content: [{ type: 'text', text: '{"persisted":true,"receipt":{"status":"noop","changes":[]},"set":false}' }] };
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name,
      args: { node_path: 'Collision', property, value: null } }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
    return { role: 'toolResult', toolCallId: id, toolName: name, content: result.content, isError: false };
  };
  const diagnose = async () => ({ kind: 'failed', reason: 'invalid JSON', invalidOutput: true, latencyMs: 1 });
  const active = harness('active', diagnose, [], undefined, { limits });
  emitNoop(active, 'a', 'shape');
  const first = emitNoop(active, 'b', 'shape');
  const advice = await boundary(active, first);
  assert.match(advice.entries[0].content, /Do not repeat the null assignment/);
  assert.equal(active.entries.find(entry => entry.customType === 'pi-sitter-outcome' && entry.data.kind === 'delivered').data.source, 'fallback');
  emitNoop(active, 'c', 'texture');
  const second = emitNoop(active, 'd', 'texture');
  assert.equal(await boundary(active, second), undefined);
  assert.equal(active.entries.filter(entry => entry.customType === 'pi-sitter-event').length, 2);
  assert.equal(active.entries.filter(entry => entry.customType === 'pi-sitter-outcome' && entry.data.kind === 'delivered').length, 1);
  await active.commands.get('sitter').handler('status', active.ctx);
  assert.match(active.notices.at(-1)[0], /Intervention budget exhausted/);

  const shadow = harness('shadow', diagnose, [], undefined, { limits });
  emitNoop(shadow, 'a', 'shape');
  assert.equal(await boundary(shadow, emitNoop(shadow, 'b', 'shape')), undefined);
  assert.equal(shadow.entries.filter(entry => entry.customType === 'pi-sitter-outcome' && entry.data.kind === 'delivered').length, 0);
});

test('two identical edit errors get one fallback after inference is exhausted', async () => {
  const limits = { ...piSitterLimits(), maxInferenceAttempts: 1, maxFallbackAdvisories: 1 };
  let inferenceCalls = 0;
  const h = harness('active', async () => {
    inferenceCalls++;
    return { kind: 'failed', reason: 'unsupported diagnosis', latencyMs: 1 };
  }, [], undefined, { limits });
  emitTool(h, 'initial-a');
  await boundary(h, emitTool(h, 'initial-b'));
  assert.equal(inferenceCalls, 1);
  const emitEdit = id => {
    const toolName = 'edit';
    const text = 'No changes made to test/stage02.test.ts. The replacement produced identical content. This might indicate an issue with special characters.';
    const result = { content: [{ type: 'text', text }] };
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName, args: { path: 'test/stage02.test.ts' } }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName, result, isError: true }, h.ctx);
    return { role: 'toolResult', toolCallId: id, toolName, content: result.content, isError: true };
  };
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-event').length, 1);
  emitEdit('edit-a');
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-event').length, 1);
  const advice = await boundary(h, emitEdit('edit-b'));
  assert.match(advice.entries[0].content, /Stop repeating the edit/);
  assert.match(advice.entries[0].content, /Do not edit protected acceptance tests/);
  assert.equal(inferenceCalls, 1);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-outcome' && entry.data.kind === 'delivered').length, 1);
  assert.equal(h.entries.find(entry => entry.customType === 'pi-sitter-outcome' && entry.data.kind === 'delivered').data.source, 'fallback');
  assert.equal(await boundary(h, emitEdit('edit-c')), undefined);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-event').length, 2);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-outcome' && entry.data.kind === 'delivered').length, 1);
});

test('post-advice same-tool progress records Worker recovery; repeated ineffective calls warn', async () => {
  const name = 'project_scene_edit_set_node_property';
  const h = harness('active', async () => ({ kind: 'failed', reason: 'unavailable', latencyMs: 1 }), [], undefined,
    { limits: { ...piSitterLimits(), maxInferenceAttempts: 1 } });
  const emit = (id, value, body) => {
    const result = { content: [{ type: 'text', text: JSON.stringify(body) }] };
    h.handlers.get('tool_execution_start')({ toolCallId: id, toolName: name,
      args: { node_path: 'Collision', property: 'shape', value } }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: id, toolName: name, result, isError: false }, h.ctx);
    return { role: 'toolResult', toolCallId: id, toolName: name, content: result.content, isError: false };
  };
  const noop = { persisted: true, receipt: { status: 'noop', changes: [] }, set: false };
  emit('a', null, noop);
  const advice = (await boundary(h, emit('b', null, noop))).entries[0].content;
  assert.ok(advice.includes('Do not repeat the null assignment'));
  const started = h.entries.find(entry => entry.customType === 'pi-sitter-intervention');
  const card = h.entryRenderers.get('pi-sitter-intervention')(started, { expanded: false },
    { appearance: 'dark', style: text => text });
  assert.match(card.render(100).join('\n'), /GUIDANCE SUPPLIED — DELIVERY PENDING/);
  h.handlers.get('context')({ messages: [{ role: 'custom', customType: 'pi-sitter-advisory', content: advice }] });
  assert.match(card.render(100).join('\n'), /GUIDANCE RECEIVED — REPAIR UNVERIFIED/);
  emit('c', null, noop);
  emit('d', null, noop);
  assert.ok(h.notices.some(([message]) => message.includes('loop unresolved')));
  emit('e', 'assets/shapes/item_circle.json', {
    persisted: true, receipt: { status: 'updated', changes: [{ op: 'set', before: null, after: 'assets/shapes/item_circle.json' }] }, set: true,
  });
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-worker-recovery').length, 1);
  assert.match(card.render(100).join('\n'), /WORKER ACTED — REPAIR UNVERIFIED/);
  await h.commands.get('sitter').handler('status', h.ctx);
  assert.match(h.notices.at(-1)[0], /Worker recoveries 1/);
});

test('duplicate diagnosis across distinct triggers produces no second advisory', async () => {
  const h = harness('active');
  emitTool(h, 'a'); const first = emitTool(h, 'b');
  assert.equal((await boundary(h, first)).entries.length, 1);
  emitTool(h, 'c', '{"error":"different failure at line 4"}');
  const second = emitTool(h, 'd', '{"error":"different failure at line 4"}');
  assert.equal(await boundary(h, second), undefined);
  assert.deepEqual(h.entries.filter(x => x.customType === 'pi-sitter-outcome').map(x => x.data.kind), ['delivered', 'duplicate']);
});

test('Active never delivers to a finished turn, but records the diagnosis', async () => {
  const h = harness('active');
  emitTool(h, 'a'); const result = emitTool(h, 'b');
  assert.equal(await boundary(h, result, 'stop'), undefined);
  assert.equal(h.entries.find(x => x.customType === 'pi-sitter-outcome').data.kind, 'delivery_failed');
});

test('inference budget persists across session reload and failures fail open', async () => {
  const h = harness('active', async () => ({ kind: 'failed', reason: 'server unavailable', latencyMs: 3 }));
  emitTool(h, 'a'); await boundary(h, emitTool(h, 'b'));
  emitTool(h, 'c', '{"error":"different failure at line 4"}');
  await boundary(h, emitTool(h, 'd', '{"error":"different failure at line 4"}'));
  assert.equal(h.entries.filter(x => x.customType === 'pi-sitter-call').length, 2);
  assert.equal(h.entries.filter(x => x.customType === 'pi-sitter-outcome').length, 2);
  const resumed = harness('active', async () => { throw Error('should not run'); }, h.entries);
  await resumed.commands.get('sitter').handler('status', resumed.ctx);
  assert.match(resumed.notices.at(-1)[0], /inference 2\/3;.*failed 2; budget 1/);
});

test('Turning supervision off aborts active diagnosis and prevents delivery', async () => {
  const h = harness('active', (_ctx, _input, _limits, signal, onText) => new Promise(r => {
    onText('{"issue":'); signal.addEventListener('abort', () => r({ kind: 'canceled', latencyMs: 1 }));
  }));
  emitTool(h, 'a'); const promise = boundary(h, emitTool(h, 'b'));
  await new Promise(r => setImmediate(r));
  await h.commands.get('sitter').handler('off', h.ctx);
  assert.equal(await promise, undefined);
  assert.equal(h.statuses.at(-1)[1], undefined);
  assert.equal(h.entries.find(x => x.customType === 'pi-sitter-outcome').data.kind, 'canceled');
  h.handlers.get('session_shutdown')({ type: 'session_shutdown', reason: 'reload' }, h.ctx);
  assert.equal(h.statuses.at(-1)[1], undefined);
});

test('Session switch aborts old diagnosis without writing into the new session', async () => {
  const h = harness('active', (_ctx, _input, _limits, signal) => new Promise(resolve => {
    signal.addEventListener('abort', () => resolve(ready), { once: true });
  }));
  emitTool(h, 'a'); const oldBoundary = boundary(h, emitTool(h, 'b'));
  await new Promise(resolve => setImmediate(resolve));
  h.ctx.sessionManager.getSessionId = () => 'new-session';
  h.handlers.get('session_start')({ type: 'session_start', reason: 'switch' }, h.ctx);
  assert.equal(await oldBoundary, undefined);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-outcome').length, 0);
  const interrupted = h.entries.find(entry => entry.customType === 'pi-sitter-intervention');
  assert.equal(interrupted?.data.phase, 'started');
  const lines = h.entryRenderers.get('pi-sitter-intervention')(interrupted, { expanded: false },
    { appearance: 'dark', style: text => text }).render(80);
  assert.match(lines.join(''), /Supervision ended before a result was recorded/);
  assert.equal(h.statuses.at(-1)[1], `<muted>Pi Sitter v${installedPiSitterVersion()} active | sleeping | 1 trigger</muted>`);
});

test('Late T3 advisory is recorded without requesting another Worker turn', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-sitter-late-'));
  process.env.PI_SITTER_STAGE = '04';
  try {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'main.json'), '[node name="Items" type="Module" parent="."]\n');
    writeFileSync(join(dir, 'src/main.ts'), 'extends Module\nvar item_scene = preload(./item.ts)\n');
    const h = harness('active');
    h.ctx.cwd = dir;
    h.handlers.get('tool_execution_start')({ toolCallId: 'write', toolName: 'project_scripts_write', args: {} }, h.ctx);
    h.handlers.get('tool_execution_end')({ toolCallId: 'write', toolName: 'project_scripts_write',
      result: { content: [{ type: 'text', text: '{"receipt":{"status":"updated","changes":[{"op":"write","before":null,"after":"saved"}]}}' }] }, isError: false }, h.ctx);
    const result = await h.handlers.get('agent_before_settle')({ type: 'agent_before_settle',
      outcome: 'completed', entries: [], continue: false }, h.ctx);
    assert.equal(result, undefined);
    assert.equal(h.entries.find(x => x.customType === 'pi-sitter-outcome')?.data.kind, 'ready');
    assert.equal(h.entries.filter(x => x.customType === 'pi-sitter-call').length, 1);
  } finally {
    delete process.env.PI_SITTER_STAGE;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Observer exception leaves finalized Worker result untouched', () => {
  const h = harness();
  const initialEntries = h.entries.length;
  h.pi.appendEntry = () => { throw Error('session write failed'); };
  emitTool(h, 'a'); const result = emitTool(h, 'b');
  assert.equal(result.isError, false);
  assert.match(result.content[0].text, /Invalid preload/);
  assert.equal(h.entries.length, initialEntries);
});

test('startup has no announcement and no-tests mode does not attempt verification', async () => {
  const h = harness('active', async () => ready);
  const startup = h.entries.filter(entry => entry.customType === 'pi-sitter-startup');
  assert.equal(startup.length, 0);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-readiness').length, 0);
  assert.equal(h.notices.length, 0);
  h.handlers.get('session_start')({ type: 'session_start', reason: 'resume' }, h.ctx);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-startup').length, 0);
  await h.commands.get('sitter').handler('verify', h.ctx);
  assert.ok(h.notices.some(([message]) => /no-tests mode/.test(message)));
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-verification-attempt').length, 0);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-completion').length, 0);
  assert.equal(h.sent.length, 0);
});

test('host-only plan selection reports its result without startup setup notices or executing tests', async () => {
  let selected;
  const setup = { getSelectedPlanId: () => selected,
    selectApprovedPlan(id) { if (id !== 'approved-v1') throw new Error('Unknown host plan'); selected = id; },
    preflight: (_stage, _root, id) => ({ ready: id === 'approved-v1', reason: 'Select an approved plan' }) };
  const h = harness('active', async () => ready, [], undefined, { verificationSetup: setup,
    resolveApprovedVerifier: () => undefined });
  const cards = () => h.entries.filter(entry => entry.customType === 'pi-sitter-readiness');
  assert.equal(cards().length, 0);
  const renderer = h.entryRenderers.get('pi-sitter-readiness');
  const theme = { appearance: 'dark', style: text => text };
  assert.equal(h.notices.length, 0);
  assert.equal(h.commands.get('sitter').getArgumentCompletions('setup').length, 0);
  await h.commands.get('sitter').handler('use npm test', h.ctx);
  assert.equal(selected, undefined);
  await h.commands.get('sitter').handler('use missing', h.ctx);
  assert.equal(selected, undefined);
  await h.commands.get('sitter').handler('use approved-v1', h.ctx);
  assert.equal(selected, 'approved-v1');
  assert.equal(cards().length, 1);
  assert.equal(cards()[0].data.planId, 'approved-v1');
  assert.match(renderer({ data: cards()[0].data }, { expanded: false }, theme).render(100).join('\n'), /NO TEST COMMAND/);
  h.handlers.get('session_start')({ type: 'session_start', reason: 'resume' }, h.ctx);
  assert.equal(cards().length, 1);
  assert.equal(h.entries.filter(entry => entry.customType === 'pi-sitter-verification-attempt').length, 0);
});

test('/sitter verify runs at an idle boundary and blocks before legacy verifier without controller authority', async () => {
  process.env.PI_SITTER_STAGE = '02';
  try {
    let calls = 0;
    const report = { schemaVersion: 1, stage: '02', snapshotIdentity: 'a'.repeat(64), snapshotFiles: 4,
      source: 'reviewed', counts: { PASS: 2, FAIL: 1, UNVERIFIED: 0 }, gates: [], regressions: ['REQ-PLAYER-SCRIPT'],
      missingDeliverables: ['REQ-PLAYER-SCRIPT'], validationLimitations: [] };
    const h = harness('shadow', async () => ready, [], async (stage, cwd, options) => {
      calls++;
      assert.equal(stage, '02');
      assert.equal(cwd, '/unused');
      assert.equal(options.previous, undefined);
      return report;
    });
    h.ctx.isIdle = () => false;
    await h.commands.get('sitter').handler('verify', h.ctx);
    assert.equal(calls, 0);
    h.ctx.isIdle = () => true;
    await h.commands.get('sitter').handler('verify', h.ctx);
    assert.equal(calls, 0);
    assert.deepEqual(h.entries.filter(entry => entry.customType === 'pi-sitter-verification').map(entry => entry.data), []);
    assert.equal(h.entries.find(entry => entry.customType === 'pi-sitter-completion')?.data.decision, 'BLOCKED');
    assert.ok(h.notices.length >= 1);
    assert.ok(h.notices.some(([message]) => /after the Worker turn completes/.test(message)));
  } finally { delete process.env.PI_SITTER_STAGE; }
});

// Golden observations from the unchanged 0.1.0 engine. These fixtures pin trigger timing,
// evidence, reset and suppression without granting a new tool-classification policy.
const observation = (toolName, args, body, isError = false) => ({
  toolCallId: `${toolName}:${JSON.stringify(args)}`, toolName, args,
  result: { content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }, isError,
});
const progress = (toolName = 'project_scene_edit_set_node_property') => observation(toolName,
  { node: 'Player', property: 'shape', value: 'circle' },
  { receipt: { status: 'updated', changes: [{ op: 'set', before: null, after: 'circle' }] } });

test('T1 fires on the second equivalent failure, deduplicates, then re-arms after same-tool progress', () => {
  const engine = new PiSitterEngine('active');
  const failure = line => observation('project_scripts_write', { path: 'main.ts' },
    { ok: false, errors: [{ message: `Invalid preload at line ${line}` }] });
  assert.equal(engine.observe(failure(3)), undefined);
  const first = engine.observe(failure(4));
  assert.deepEqual({ type: first?.type, evidence: first?.evidence },
    { type: 'T1', evidence: '2 equivalent failures: [{"message":"Invalid preload at line 4"}]' });
  assert.equal(engine.observe(failure(5)), undefined);
  assert.equal(engine.triggerCount, 1);
  assert.equal(engine.observe(progress('project_scripts_write')), undefined);
  assert.equal(engine.observe(failure(6)), undefined);
  assert.equal(engine.observe(failure(7))?.type, 'T1');
  assert.equal(engine.triggerCount, 2);
});

test('T2 pins two enables, three discoveries, repeated setup and progress reset', () => {
  for (const [name, threshold] of [['project_enable_toolset', 2], ['tool_search', 3], ['project_list_toolsets', 3]]) {
    const engine = new PiSitterEngine('active');
    const call = observation(name, { query: 'scene' }, { ok: true });
    for (let n = 1; n < threshold; n++) assert.equal(engine.observe(call), undefined, `${name} at ${n}`);
    assert.deepEqual({ type: engine.observe(call)?.type, count: engine.triggerCount }, { type: 'T2', count: 1 }, name);
    assert.equal(engine.observe(call), undefined, `${name} duplicate`);
    engine.observe(progress());
    for (let n = 1; n < threshold; n++) assert.equal(engine.observe(call), undefined, `${name} reset at ${n}`);
    assert.equal(engine.observe(call)?.type, 'T2');
  }
  const mixed = new PiSitterEngine('active');
  const a = observation('project_list_toolsets', {}, { ok: true });
  const b = observation('project_health_check', {}, { ok: true });
  for (const call of [a, b, a, b]) assert.equal(mixed.observe(call), undefined);
  assert.equal(mixed.observe(a)?.type, 'T2');
});

test('T3 runs only a configured final validator and suppresses the same milestone', () => {
  const engine = new PiSitterEngine('active');
  const evidence = { stage: '04', gameDir: '/project', final: true };
  let checks = 0;
  const validators = { '04': () => { checks++; return 'Saved configuration is incomplete'; } };
  assert.equal(engine.milestone({ ...evidence, final: false }, validators), undefined);
  assert.equal(engine.milestone({ ...evidence, stage: '05' }, validators), undefined);
  assert.equal(checks, 0);
  assert.deepEqual({ type: engine.milestone(evidence, validators)?.type, checks }, { type: 'T3', checks: 1 });
  assert.equal(engine.milestone(evidence, validators), undefined);
  assert.equal(checks, 2);
});

test('T4 pins no-op and repeated recovery inspection thresholds and progress reset', () => {
  const noop = name => observation(name, { node: 'Player' }, { receipt: { status: 'noop', changes: [] } });
  const engine = new PiSitterEngine('active');
  assert.equal(engine.observe(noop('project_scene_edit_set_node_property')), undefined);
  assert.equal(engine.observe(noop('project_scene_edit_set_node_property'))?.type, 'T4');
  assert.equal(engine.observe(noop('project_scene_edit_set_node_property')), undefined);
  engine.observe(progress());
  assert.equal(engine.observe(noop('project_scene_edit_set_node_property')), undefined);
  assert.equal(engine.observe(noop('project_scene_edit_set_node_property'))?.type, 'T4');
  const opening = new PiSitterEngine('active');
  assert.equal(opening.observe(noop('project_open_scene')), undefined);
  assert.equal(opening.observe(noop('project_open_scene')), undefined);
  assert.equal(opening.observe(noop('project_open_scene')), undefined);
  assert.equal(opening.triggerCount, 0); // Existing classifier reports UNKNOWN for this name.
  const inspection = observation('project_scene_tree', { scene: 'main' }, { nodes: [] });
  const recovering = new PiSitterEngine('active');
  recovering.observe(noop('project_scene_edit_set_node_property'));
  for (let n = 1; n < 3; n++) assert.equal(recovering.observe(inspection), undefined);
  assert.match(recovering.observe(inspection)?.evidence ?? '', /3 identical inspections/);
  assert.equal(recovering.observe(inspection), undefined);
  recovering.observe(progress());
  assert.equal(recovering.observe(inspection), undefined);
});

test('T5 counts only consecutive identical successful inspections before recovery', () => {
  const read = (name = 'mcp__godot__godot_inspection_get_scene_tree', body = { tree: 'meteor' }) =>
    observation(name, { lightweight: true }, body);
  const engine = new PiSitterEngine('active');
  for (let n = 0; n < 4; n++) assert.equal(engine.observe(read()), undefined);
  assert.equal(engine.observe(read('mcp__godot__godot_inspection_get_scene_tree', { tree: 'main' })), undefined);
  for (let n = 0; n < 4; n++) assert.equal(engine.observe(read()), undefined);
  assert.equal(engine.observe(read())?.type, 'T5');
  assert.equal(engine.observe(read()), undefined);
  engine.observe(progress());
  for (let n = 0; n < 4; n++) assert.equal(engine.observe(read()), undefined);
  assert.equal(engine.observe(read())?.type, 'T5');
  const recovering = new PiSitterEngine('active');
  recovering.observe(observation('project_scene_edit_set_node_property', { node: 'Player' },
    { receipt: { status: 'noop', changes: [] } }));
  assert.equal(recovering.observe(read()), undefined);
  assert.equal(recovering.observe(read()), undefined);
  assert.equal(recovering.observe(read())?.type, 'T4');
  const long = new PiSitterEngine('active');
  const prefix = 'x'.repeat(4200);
  for (let n = 0; n < 4; n++) assert.equal(long.observe(read(undefined, `${prefix}a`)), undefined);
  assert.equal(long.observe(read(undefined, `${prefix}b`)), undefined);
  for (let n = 0; n < 3; n++) assert.equal(long.observe(read(undefined, `${prefix}b`)), undefined);
  assert.equal(long.observe(read(undefined, `${prefix}b`))?.type, 'T5');
  const off = new PiSitterEngine('off');
  for (let n = 0; n < 6; n++) assert.equal(off.observe(read()), undefined);
});

test('tool classifiers retain current aliases and plain-text uncertainty', () => {
  const cases = [
    ['project_save_scene', '{"receipt":{"status":"updated","changes":[{"op":"save","before":null,"after":"saved"}]}}', 'PROGRESS'],
    ['project_scene_tree', '{"nodes":[]}', 'INSPECTION'],
    ['project_scripts_get_parse_errors', '{"errors":[]}', 'INSPECTION'],
    ['project_open_scene', '{"receipt":{"status":"noop","changes":[]}}', 'UNKNOWN'],
    ['project_enable_toolset', '{"ok":true}', 'INSPECTION'],
    ['project_scripts_edit', 'Edited main.ts successfully', 'UNKNOWN'],
    ['project_scripts_write', 'Wrote main.ts successfully', 'UNKNOWN'],
  ];
  for (const [name, body, expected] of cases)
    assert.equal(classifyObservation(observation(name, {}, body)).kind, expected, name);
  assert.equal(piSitterLimits().maxTriggers, 16);
  assert.equal(piSitterLimits('{"maxTriggers":32}').maxTriggers, 32);
  const engine = new PiSitterEngine('active', { maxTriggers: 32 });
  for (let n = 0; n < 32; n++) engine.restoreTrigger({ type: 'T1', tool: 'x', evidence: 'x', key: `k${n}` });
  assert.equal(engine.triggerCount, 32);
  assert.equal(engine.budgetRemaining, 0);
});

test('Off suppresses observations and mode changes clear in-flight setup; reset clears duplicate history', () => {
  const engine = new PiSitterEngine('off');
  const enable = observation('project_enable_toolset', {}, { ok: true });
  assert.equal(engine.observe(enable), undefined);
  assert.equal(engine.recent.length, 0);
  engine.setMode('shadow');
  assert.equal(engine.observe(enable), undefined);
  engine.setMode('off');
  engine.setMode('active');
  assert.equal(engine.observe(enable), undefined);
  assert.equal(engine.observe(enable)?.type, 'T2');
  engine.reset('active');
  assert.equal(engine.triggerCount, 0);
  assert.equal(engine.observe(enable), undefined);
  assert.equal(engine.observe(enable)?.type, 'T2');
});
