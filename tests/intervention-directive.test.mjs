import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PiSitterEngine, advisoryArgs, classifyObservation, operationSignature } from '../src/core.ts';
import { buildWorkerDirective, conciseDiagnosticFailures, triggerObservation, weakLoopAction } from '../src/intervention-directive.ts';
import { genericFallback } from '../src/fallback.ts';

// Recorded Worker calls, both T4 records, and diagnostic first lines from the
// complete retry transcript. Kept local so the runtime suite has no benchmark dependency.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/stage04-interventions.json', import.meta.url), 'utf8'));
const observation = (call, index) => ({ toolCallId: `recorded-${index}`, toolName: call.name, args: call.args,
  result: { content: [{ type: 'text', text: call.result }] }, isError: call.isError });
const diagnosis = value => ({ issue: value.issue, evidence: value.evidence,
  next_action: value.nextAction, confidence: 0.9, abstain: false });

test('recorded Stage 04 receipts distinguish preview, real save, and identical attachment', () => {
  const find = (suffix, contains) => fixture.calls.find(call => call.name.endsWith(suffix) && call.result.includes(contains));
  for (const [suffix, text] of [['godot_scripts_write', '"dry_run": true'],
    ['godot_scene_edit_attach_script', '"dry_run": true'],
    ['godot_scene_edit_create_node', '"dry_run": true'],
    ['godot_scene_edit_save_scene', '"saved": false']]) {
    const call = find(suffix, text);
    assert.ok(call, `${suffix} ${text}`);
    assert.equal(classifyObservation(observation(call, 0)).kind, 'NO_CHANGE');
  }
  const saved = find('godot_scene_edit_save_scene', '"saved": true');
  assert.ok(saved);
  assert.equal(classifyObservation(observation(saved, 1)).kind, 'PROGRESS');
  const identicalSave = { name: saved.name, args: { dry_run: false }, result: JSON.stringify({ saved: true,
    dry_run: false, receipt: { status: 'updated', changes: [{ op: 'set', before: 'same', after: 'same' }] } }), isError: false };
  assert.equal(classifyObservation(observation(identicalSave, 2)).kind, 'NO_CHANGE');
  const identical = fixture.calls.find(call => call.name.endsWith('godot_scene_edit_attach_script') &&
    call.result.includes('"before":"res://scripts/meteor.gd","after":"res://scripts/meteor.gd"'));
  assert.equal(classifyObservation(observation(identical, 2)).kind, 'NO_CHANGE');
});

test('full recorded call replay keeps first T4 and treats the later save as progress', () => {
  const engine = new PiSitterEngine('active');
  engine.setTask(fixture.task, '04');
  const triggers = [];
  let firstRecent, secondRecent, secondProgress;
  for (const [index, call] of fixture.calls.entries()) {
    const trigger = engine.observe(observation(call, index));
    if (trigger) {
      triggers.push(trigger);
      if (trigger.type === 'T4' && trigger.tool.endsWith('godot_scene_edit_create_node')) firstRecent = [...engine.recent];
    }
    if (call.time === '2026-11-23T02:10:26.955Z') {
      secondRecent = [...engine.recent];
      secondProgress = engine.progressVersion;
    }
  }
  assert.equal(triggers.filter(item => item.type === 'T4').length, 1);
  assert.equal(triggers[0].tool, fixture.firstTrigger.tool);
  assert.match(triggers[0].evidence, /dry_run:true/);
  assert.ok(firstRecent && secondRecent);
  assert.ok(secondProgress > 0);
  const first = buildWorkerDirective({ trigger: fixture.firstTrigger, diagnosis: diagnosis(fixture.firstModel),
    recent: firstRecent, task: fixture.task, stage: '04', progressVersion: 0, source: 'model' });
  assert.match(first, /Stop repeating .*godot_scene_edit_create_node/);
  assert.match(first, /dry_run:true/);
  assert.match(first, /created:false/);
  assert.match(first, /changes:\[\]/);
  assert.doesNotMatch(first, /desynchroniz|may already exist/i);
  const weak = weakLoopAction(fixture.secondTrigger, diagnosis(fixture.secondModel), secondRecent, fixture.task);
  assert.match(weak, /generic inspection|distinct/);
  const fallback = genericFallback(fixture.secondTrigger, secondRecent);
  const second = buildWorkerDirective({ trigger: fixture.secondTrigger, diagnosis: fallback,
    recent: secondRecent, task: fixture.task, stage: '04', progressVersion: secondProgress, source: 'fallback',
    diagnostic: { ...fixture.diagnostic, progressVersion: secondProgress - 1 } });
  assert.match(second, /Stop calling .*godot_inspection_get_scene_tree with \{\}/);
  assert.match(second, /Do not call it again until a saved change or a new relevant fact exists/);
  assert.match(second, /Read "res:\/\/scripts\/main.gd" with mcp__godot__godot_scripts_read/);
  assert.match(second, /Earlier host diagnostic, before later saved changes/);
  assert.doesNotMatch(second, /Next: Inspect the expected scene structure/);
});

test('weak, repeated, and invented loop actions are rejected; a grounded alternate passes', () => {
  const trigger = fixture.secondTrigger;
  const recent = [{ toolName: trigger.tool, args: '{}', result: '{"tree":{}}', isError: false },
    { toolName: 'project_scripts_read', args: '{"script_path":"src/main.ts"}', result: 'source', isError: false }];
  const candidate = next_action => ({ next_action });
  assert.match(weakLoopAction(trigger, candidate('Inspect the scene tree again'), recent, 'Read src/main.ts'), /repeats/);
  assert.match(weakLoopAction(trigger, candidate('Inspect the expected structure'), recent, 'Read src/main.ts'), /generic|distinct/);
  assert.match(weakLoopAction(trigger, candidate('Read src/secret.ts'), recent, 'Read src/main.ts'), /path absent/);
  assert.match(weakLoopAction(trigger, candidate('Read /tmp/secret.txt'), recent, 'Read src/main.ts'), /path absent/);
  assert.equal(weakLoopAction(trigger, candidate('Read src/main.ts with project_scripts_read'), recent, 'Read src/main.ts'), undefined);
  assert.equal(weakLoopAction(trigger, candidate(`Read src/other.ts with ${trigger.tool}`), recent,
    'Read src/main.ts and src/other.ts'), undefined);
});

test('task-named saved file keeps a repeated inspection from becoming a false blocker', () => {
  const trigger = { type: 'T5', tool: 'mcp__godot__godot_inspection_get_scene_tree',
    evidence: '5 identical inspections of unchanged state without progress', key: 'T5:fixture:receipt:0' };
  const recent = [{ toolName: trigger.tool, args: { max_depth: 5 }, result: '{"tree":{"name":"meteor"}}', isError: false }];
  const directive = buildWorkerDirective({ trigger, diagnosis: genericFallback(trigger, recent), recent,
    task: 'Inspect res://main.tscn and res://scripts/meteor.gd; repair and save the scene.',
    stage: '04', progressVersion: 0, source: 'fallback' });
  assert.match(directive, /Inspect the saved "res:\/\/main\.tscn"/);
  assert.match(directive, /read "main\.tscn" with a file tool/);
  assert.match(directive, /You must carry out the original task's requested source repair/);
  assert.match(directive, /Do not finish with only a diagnosis or a plan/);
  assert.doesNotMatch(directive, /no distinct grounded read is available/);
});

test('file-tool res path failure gives the exact corrected path before repair', () => {
  const trigger = { type: 'T1', tool: 'read', evidence: '2 equivalent failures', key: 'T1:read:fixture:0' };
  const recent = [{ toolName: 'read', args: { path: 'res://scripts/meteor.gd' },
    result: "ENOENT: no such file or directory, access '/project/res:/scripts/meteor.gd'", isError: true }];
  const directive = buildWorkerDirective({ trigger, diagnosis: diagnosis({ issue: 'Wrong path',
    evidence: trigger.evidence, nextAction: 'Inspect the root directory' }), recent,
    task: 'Read res://scripts/meteor.gd and make the requested repair.', stage: '04',
    progressVersion: 0, source: 'model' });
  assert.match(directive, /Use read with \{"path":"scripts\/meteor\.gd"\}/);
  assert.doesNotMatch(directive, /Next: Inspect the root directory/);
  assert.match(directive, /make a supported change, save it, and check the saved result/);
});

test('Stage 05 long-body edit retains only its route and directs a Godot script write', () => {
  const path = 'res://scripts/main.gd';
  const original = { operation: 'edit'.repeat(20), property: 'source'.repeat(10),
    oldText: 'x'.repeat(3200), newText: 'private source replacement', path };
  const preview = advisoryArgs('edit', original);
  assert.match(preview, /res:\/\/scripts\/main\.gd/);
  assert.doesNotMatch(preview, /private source|xxxx/);
  const engine = new PiSitterEngine('active');
  const task = 'Repair res://scripts/main.gd using Godot Editor MCP.';
  engine.setTask(task, '05');
  engine.observe({ toolCallId: 'mcp-read', toolName: 'mcp__godot__godot_scripts_read',
    args: { script_path: path }, result: { content: [{ type: 'text', text: 'source' }] }, isError: false });
  const bad = (id, input) => engine.observe({ toolCallId: id, toolName: 'edit', args: input,
    result: { content: [{ type: 'text', text: `ENOENT: ${path}` }] }, isError: true });
  assert.equal(bad('first', original), undefined);
  const trigger = bad('second', original);
  assert.equal(trigger?.type, 'T1');
  const directive = buildWorkerDirective({ trigger, diagnosis: diagnosis({ issue: 'Wrong route',
    evidence: trigger.evidence, nextAction: 'Read the same script again' }), recent: engine.recent,
    task, stage: '05', progressVersion: engine.progressVersion, source: 'model',
    availableTools: ['mcp__godot__godot_scripts_write'] });
  assert.match(directive, /Pi edit cannot use "res:\/\/scripts\/main\.gd"/);
  assert.match(directive, /godot_scripts_write using \{"script_path":"res:\/\/scripts\/main\.gd"\}/);
  assert.doesNotMatch(directive, /Next: Read the same script again|private source replacement|xxxx/);
  const unavailable = buildWorkerDirective({ trigger, diagnosis: diagnosis({ issue: 'Wrong route',
    evidence: trigger.evidence, nextAction: 'Read the same script again' }), recent: engine.recent,
    task, stage: '05', progressVersion: engine.progressVersion, source: 'model', availableTools: [] });
  assert.match(unavailable, /Godot mutation route is unavailable/);
  assert.doesNotMatch(unavailable, /Next: Use edit/);
  engine.observe({ toolCallId: 'read', toolName: 'mcp__godot__godot_scripts_read',
    args: { script_path: path }, result: { content: [{ type: 'text', text: 'source' }] }, isError: false });
  assert.equal(engine.progressVersion, 0);
  assert.equal(bad('changed-body', { ...original, newText: 'another source replacement' }), undefined);
  assert.equal(engine.progressVersion, 0);
});

test('generic res path mutation gets a project-relative Pi path without replacement text', () => {
  const trigger = { type: 'T1', tool: 'write', evidence: '2 equivalent failures', key: 'T1:write:fixture:0' };
  const recent = [{ toolName: 'write', args: advisoryArgs('write', { content: 'secret body', path: 'res://src/main.ts' }),
    result: 'ENOENT', isError: true }];
  const directive = buildWorkerDirective({ trigger, diagnosis: diagnosis({ issue: 'Wrong path',
    evidence: trigger.evidence, nextAction: 'Try again' }), recent,
    task: 'Write src/main.ts in an ordinary project', stage: 'fixture', progressVersion: 0, source: 'model' });
  assert.match(directive, /Use write with \{"path":"src\/main\.ts"\}/);
  assert.doesNotMatch(directive, /secret body/);
});

test('Godot scene file correction uses exposed scene operations', () => {
  const trigger = { type: 'T1', tool: 'write', evidence: '2 equivalent failures', key: 'T1:write:scene:0' };
  const directive = buildWorkerDirective({ trigger, diagnosis: diagnosis({ issue: 'Wrong route',
    evidence: trigger.evidence, nextAction: 'Try Pi write again' }),
    recent: [{ toolName: 'write', args: advisoryArgs('write', { path: 'res://main.tscn', content: 'large scene body' }),
      result: 'ENOENT', isError: true }], task: 'Edit the scene with Godot Editor MCP.',
    stage: '05', progressVersion: 0, source: 'model',
    availableTools: ['mcp__godot__godot_scene_edit_open_scene', 'mcp__godot__godot_scene_edit_save_scene'] });
  assert.match(directive, /godot_scene_edit_open_scene using \{"scene_path":"res:\/\/main\.tscn"\}/);
  assert.match(directive, /godot_scene_edit_save_scene/);
  assert.doesNotMatch(directive, /Next: Use write|large scene body/);
});

test('directive selects the exact triggered arguments when a later call uses the same tool differently', () => {
  const toolName = 'project_scripts_read';
  const first = { toolName, args: { path: 'src/a.ts' }, result: '{"content":"A"}', isError: false };
  const second = { toolName, args: { path: 'src/b.ts' }, result: '{"content":"B"}', isError: false };
  const trigger = { type: 'T4', tool: toolName, evidence: '3 identical inspections of unchanged state during recovery',
    key: `T4:${operationSignature(toolName, first.args)}:receipt:0` };
  assert.equal(triggerObservation(trigger, [first, second]), first);
});

test('host failure summaries prioritize saved-state mismatches and remove stacks', () => {
  const rows = [{ id: 'downstream', detail: 'AssertionError: dynamic behavior unavailable\n    at /host/test.js:1:1' },
    { id: 'saved', detail: 'AssertionError: Main script=missing: expected FAIL to be PASS\n    at /host/test.js:2:1' }];
  assert.deepEqual(conciseDiagnosticFailures(rows), ['saved: Main script=missing', 'downstream: dynamic behavior unavailable']);
});
