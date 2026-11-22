import test from 'node:test';
import assert from 'node:assert/strict';
import { PiSitterEngine } from '../src/core.ts';
import { parseDiagnosis, runInference } from '../src/inference.ts';
import { buildPrompt } from '../src/prompt.ts';
import { genericFallback } from '../src/fallback.ts';
import { piSitterLimits } from '../src/config.ts';

// Sanitized Stage 02 shape: npm/Vite warnings precede the useful Vitest failure.
const output = `
> sample@1.0.0 test
> vitest run

(!) Your Vite config uses features that are unsupported by configLoader native.
This warning is about a future loader default, not the assertion.
${'warning context '.repeat(15)}

 FAIL  test/stage02.test.ts > Stage 02 - Player Ship and Horizontal Controls
AssertionError: expected output to contain ship_texture:res://assets/sprites/player.png

- Expected
+ Received
- ship_texture:res://assets/sprites/player.png
+ ship_texture:(res://assets/sprites/player.png):<CompressedTexture2D>
 ❯ test/stage02.test.ts:9:18
`;
const observation = (id, text = output) => ({ toolCallId: id, toolName: 'bash',
  args: { command: 'npm test' }, result: { content: [{ type: 'text', text }] }, isError: true });

test('T1 retains grouping identity while its bounded evidence reaches a later assertion', () => {
  const engine = new PiSitterEngine('active');
  assert.equal(engine.observe(observation('a')), undefined);
  const trigger = engine.observe(observation('b'));
  assert.equal(trigger.type, 'T1');
  assert.match(trigger.key, /^T1:bash\|/);
  assert.match(trigger.evidence, /FAIL  test\/stage02\.test\.ts/);
  assert.match(trigger.evidence, /AssertionError: expected output/);
  assert.match(trigger.evidence, /\- Expected\n\+ Received/);
  assert.ok(trigger.evidence.length <= 1300);
  assert.doesNotMatch(trigger.evidence, /Your Vite config/);
  assert.equal(engine.observe(observation('c', output.replace('player.png', 'other.png'))), undefined);
  assert.equal(engine.triggerCount, 1);
  const prompt = buildPrompt({ task: 'Repair source', stage: '02', trigger, recent: engine.recent, workerTools: [] }, 5500);
  assert.match(prompt.userText, /AssertionError: expected output/);
});

test('exact assertion quote passes; paraphrase and unrelated quote fail closed', () => {
  const engine = new PiSitterEngine('active');
  engine.observe(observation('a'));
  const trigger = engine.observe(observation('b'));
  const candidate = evidence => JSON.stringify({ issue: 'Test assertion failed', evidence,
    next_action: 'Compare expected and actual output in the failing assertion', confidence: 0.8, abstain: false });
  assert.equal(parseDiagnosis(candidate('AssertionError: expected output to contain ship_texture:res://assets/sprites/player.png'), trigger).kind, 'ready');
  assert.equal(parseDiagnosis(candidate('The output should contain the player texture'), trigger).kind, 'failed');
  assert.equal(parseDiagnosis(candidate('unrelated test failed at another location'), trigger).kind, 'failed');
  assert.equal(parseDiagnosis(candidate('Your Vite config uses features'), trigger).kind, 'failed');
});

test('uncertain repeated Vitest failure gets only an assertion inspection fallback', () => {
  const engine = new PiSitterEngine('active');
  engine.observe(observation('a'));
  const trigger = engine.observe(observation('b'));
  const fallback = genericFallback(trigger, engine.recent);
  assert.equal(parseDiagnosis(JSON.stringify(fallback), trigger).kind, 'ready');
  assert.match(fallback.next_action, /compare expected with actual/);
  assert.doesNotMatch(fallback.issue + fallback.next_action, /Vite config/);
});

test('later tool error remains quotable after a long warning preamble', () => {
  const engine = new PiSitterEngine('active');
  const text = `${'Deprecation warning: old loader option.\n'.repeat(20)}Error: unable to parse saved source at line 14\n`;
  engine.observe(observation('a', text));
  const trigger = engine.observe(observation('b', text));
  assert.match(trigger.evidence, /Error: unable to parse saved source at line 14/);
  assert.doesNotMatch(trigger.evidence, /Deprecation warning/);
  assert.equal(parseDiagnosis(JSON.stringify({ issue: 'Saved source parse failed',
    evidence: 'Error: unable to parse saved source at line 14',
    next_action: 'Inspect the source near line 14', confidence: 0.8, abstain: false }), trigger).kind, 'ready');
});

test('invalid model diagnosis retains its exact bounded reply for the user', async () => {
  const trigger = { type: 'T1', tool: 'bash', evidence: '2 equivalent failures: original test output', key: 'T1:bash:test' };
  const reply = JSON.stringify({ issue: 'Inspect a different path', evidence: 'text absent from trigger',
    next_action: 'Read the source file', confidence: 0.8, abstain: false });
  const model = { id: 'fixture', provider: 'fixture' };
  const ctx = { model, modelRegistry: { async *streamSimple() {
    yield { type: 'done', message: { stopReason: 'stop', content: [{ type: 'text', text: reply }] } };
  } } };
  const result = await runInference(ctx, { task: 'Repair source', stage: '02', trigger,
    recent: [], workerTools: [] }, piSitterLimits(), new AbortController().signal, () => {});
  assert.equal(result.kind, 'failed');
  assert.equal(result.reason, 'evidence is not grounded in the trigger');
  assert.equal(result.rawResponse, reply);
});
