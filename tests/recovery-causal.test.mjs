import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInspectionAnalysis } from '../src/analysis.ts';
import { applyRecoveryAnalysis, createRecoveryPlan, noProgressRecoveryPrompt } from '../src/completion.ts';

const source = 'a'.repeat(64);
const suite = { id: 'suite-cart', version: 'v2', digest: 'b'.repeat(64) };
const report = {
  schemaVersion: 2, taskId: 'task-cart', runId: 'run-12', stage: 'checkout', snapshotIdentity: source,
  snapshotFiles: 2, source: 'reviewed', suite, counts: { PASS: 1, FAIL: 1, UNVERIFIED: 0 },
  testCounts: { executed: 2, skipped: 0, passed: 1, failed: 1 }, regressions: [], missingDeliverables: ['TOTAL'], validationLimitations: [],
  gates: [
    { id: 'TOTAL', result: 'FAIL', requirement: 'Discounted total', evidence: 'cart total expected 90, got 100', explanation: '',
      tests: [{ id: 'discount-total', result: 'FAIL', evidence: 'cart total expected 90, got 100',
        diagnostic: { message: 'cart total expected 90, got 100', path: 'src/cart.ts', line: 42 } }] },
    { id: 'SAVE', result: 'PASS', requirement: 'Saved cart', evidence: 'save handler is broken', explanation: '',
      tests: [{ id: 'save-cart', result: 'PASS', evidence: 'save handler is broken' }] },
  ],
};
const requests = [{ capability: 'read_source', path: 'src/cart.ts' }, { capability: 'read_source', path: 'src/discount.ts' }];
function inspection(path, content, turnId = report.runId) {
  const evidence = { text: content };
  return { capability: 'read_source', path, ok: true, trust: 'untrusted_project_evidence', evidence,
    receipt: { taskId: report.taskId, turnId, tool: 'pi_sitter_inspect', operation: 'read_source',
      sourceIdentity: source, status: 'allowed', resultDigest: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
      evidenceRef: `${source}:${path}` } };
}
const results = [inspection('src/cart.ts', 'computeTotal omits applyDiscount'),
  inspection('src/discount.ts', 'applyDiscount returns amount - discount')];
const diagnosis = { cause: 'computeTotal bypasses the discount helper', confidence: 0.82,
  uncertainty: 'The rerun must confirm that the helper is called for all cart items.',
  affected: [{ path: 'src/cart.ts', function: 'computeTotal' }, { path: 'src/discount.ts', function: 'applyDiscount' }],
  steps: ['Call applyDiscount from computeTotal before summing line items.',
    'Check applyDiscount input units and return the discounted amount to computeTotal.'],
  evidenceRefs: [{ kind: 'failed_test', gateId: 'TOTAL', testId: 'discount-total', quote: 'cart total expected 90, got 100' },
    { kind: 'inspection', index: 0, quote: 'computeTotal omits applyDiscount' },
    { kind: 'inspection', index: 1, quote: 'applyDiscount returns amount - discount' }] };

test('two-file repair cites failed assertion and current inspections with ordered Worker steps and rerun IDs', async () => {
  let calls = 0;
  const outcome = await runInspectionAnalysis(report, { inspectSnapshot: async (_identity, asked, _signal, context) => {
    assert.deepEqual(asked, requests);
    assert.deepEqual(context, { taskId: report.taskId, turnId: report.runId });
    return results;
  } }, async () => ({ text: JSON.stringify(++calls === 1 ? { requests } : diagnosis) }));
  assert.equal(outcome.kind, 'ready');
  const plan = applyRecoveryAnalysis(createRecoveryPlan(report, 'Fix discounted cart total'), report, outcome);
  assert.equal(plan.diagnosis.status, 'SUPPORTED');
  assert.deepEqual(plan.diagnosis.failedTestIds, ['discount-total']);
  assert.deepEqual(plan.diagnosis.verification, { reason: 'post_repair', gateIds: ['TOTAL'], testIds: ['discount-total'] });
  assert.deepEqual(plan.diagnosis.affected.map(row => row.path), ['src/cart.ts', 'src/discount.ts']);
  assert.match(plan.text, /src\/cart.ts:42/);
  assert.ok(plan.text.indexOf('1. Call applyDiscount') < plan.text.indexOf('2. Check applyDiscount'));
  assert.match(plan.text, /run-12/);
  assert.match(plan.text.split('\n')[1], /^Do now: Call applyDiscount.*save it, and read back/);
  assert.match(plan.text, /Task: task-cart; stage: checkout/);
  assert.match(plan.text, /Suite: suite-cart@v2/);
  assert.match(plan.text, /TOTAL\/discount-total at src\/cart\.ts:42: cart total expected 90, got 100/);
  const retry = noProgressRecoveryPrompt(plan);
  assert.match(retry.split('\n')[1], /^No saved source change was observed.*Do now: Call applyDiscount/);
  assert.match(retry, new RegExp(source));
  assert.match(retry, /run-12/);
});

test('unverified recovery leads with one bounded inspection and keeps failed assertion provenance', () => {
  const plan = createRecoveryPlan(report, 'Fix discounted cart total');
  assert.match(plan.text.split('\n')[1], /Do now: inspect one existing task-related saved source artifact/);
  assert.doesNotMatch(plan.text.split('\n')[1], /computeTotal|src\/cart\.ts|expected 90/);
  assert.match(plan.text, /TOTAL\/discount-total at src\/cart\.ts:42/);
  assert.match(plan.text, /Suite: suite-cart@v2/);
  assert.match(plan.text, /run-12/);
  const retry = noProgressRecoveryPrompt(plan);
  assert.match(retry.split('\n')[1], /No saved source change was observed.*Do now: inspect one existing/);
  assert.doesNotMatch(retry, /npm test|vitest /i);
});

test('passing gate quote, stale inspection receipt, and unrelated error cannot support a root cause', async () => {
  const fromPassingGate = await runInspectionAnalysis(report, { inspectSnapshot: async () => { throw Error('unexpected'); } },
    async () => ({ text: JSON.stringify({ ...diagnosis, evidenceRefs: [{ kind: 'failed_test', gateId: 'SAVE', testId: 'save-cart', quote: 'save handler is broken' }] }) }));
  assert.equal(fromPassingGate.kind, 'abstained');
  const serializedError = inspection('src/cart.ts', 'clean source');
  serializedError.evidence = { text: 'clean source', error: 'computeTotal omits applyDiscount' };
  serializedError.receipt.resultDigest = createHash('sha256').update(JSON.stringify(serializedError.evidence)).digest('hex');
  for (const inspected of [[inspection('src/cart.ts', 'computeTotal omits applyDiscount', 'old-run')],
    [{ ...inspection('src/cart.ts', 'different text'), error: 'computeTotal omits applyDiscount', ok: false }],
    [serializedError]]) {
    let calls = 0;
    const result = await runInspectionAnalysis(report, { inspectSnapshot: async () => inspected },
      async () => ({ text: JSON.stringify(++calls === 1 ? { requests: [requests[0]] } :
        { ...diagnosis, evidenceRefs: [{ kind: 'inspection', index: 0, quote: 'computeTotal omits applyDiscount' }] }) }));
    assert.equal(result.kind, 'abstained');
    assert.equal(createRecoveryPlan(report, 'Fix discounted cart total').diagnosis.status, 'UNVERIFIED');
  }
});

test('suspected protected-suite defect is escalated without a repair instruction', () => {
  const plan = createRecoveryPlan(report, 'Fix discounted cart total');
  const result = applyRecoveryAnalysis(plan, report, { kind: 'ready', cause: 'Protected test is wrong', confidence: 0.8,
    affected: [{ path: 'src/cart.ts' }], steps: ['Edit protected suite'],
    evidenceRefs: [{ kind: 'failed_test', gateId: 'TOTAL', testId: 'discount-total', quote: 'cart total expected 90, got 100', path: 'src/cart.ts' }] });
  assert.equal(result.diagnosis.status, 'UNVERIFIED');
  assert.equal(result.diagnosis.escalation, 'protected_suite_owner');
  assert.deepEqual(result.diagnosis.actions, []);
});
