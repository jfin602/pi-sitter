import test from 'node:test';
import assert from 'node:assert/strict';
import { validateControllerContext } from '../src/controller-context.ts';
import { adaptVitestReport } from '../src/vitest-report.ts';
import { normalizeGateReport } from '../src/gates.ts';
import { decideCompletion } from '../src/completion.ts';

const sha = 'a'.repeat(64), digest = 'b'.repeat(64);
const context = validateControllerContext({ schemaVersion: 1, taskId: 'task', stage: 'final',
  originalTask: { text: 'Export data. Provide accessible controls.', reference: 'task', version: 'v1',
    requirements: [{ id: 'export', text: 'Export data.' }, { id: 'access', text: 'Provide accessible controls.' }] },
  suite: { id: 'suite', version: 'v1', digest, gates: [
    { id: 'EXPORT', requirementIds: ['export'], testIds: ['export pass'] },
    { id: 'A11Y', requirementIds: ['access'], testIds: ['accessibility fail'] },
  ] }, sourceSnapshot: sha }, 'final');
const row = (name, status) => ({ fullName: name, status, failureMessages: status === 'failed' ?
  ["AssertionError: expected 'missing' to be 'present'\n    at /fixture/sample.test.mjs:3:52"] : [] });
function envelope(status = 'passed') {
  const failed = status === 'failed' ? 1 : 0, skipped = status === 'pending' ? 1 : 0;
  return { format: 'vitest-json', taskId: 'task', runId: 'run-1', stage: 'final', snapshotIdentity: sha,
    suite: { id: 'suite', version: 'v1', digest }, execution: { exitCode: failed ? 1 : 0 },
    vitest: { success: failed === 0, numTotalTestSuites: 1, numPassedTestSuites: failed ? 0 : 1,
      numFailedTestSuites: failed ? 1 : 0, numPendingTestSuites: 0,
      numTotalTests: 2, numPassedTests: 2 - failed - skipped, numFailedTests: failed,
      numPendingTests: skipped, numTodoTests: 0,
      testResults: [{ name: '/fixture/sample.test.mjs', status: failed ? 'failed' : 'passed',
        assertionResults: [row('export pass', 'passed'), row('accessibility fail', status)] }] } };
}
const normalize = value => normalizeGateReport(adaptVitestReport(value, context), context);

test('Vitest JSON pass and attributable nonzero assertion failure', () => {
  const pass = normalize(envelope());
  assert.deepEqual(pass.testCounts, { executed: 2, skipped: 0, passed: 2, failed: 0 });
  assert.equal(decideCompletion(pass).decision, 'UNVERIFIED');
  const fail = normalize(envelope('failed'));
  assert.equal(fail.gates[1].result, 'FAIL');
  assert.equal(fail.gates[1].tests[0].diagnostic.path, '/fixture/sample.test.mjs');
  assert.equal(fail.gates[1].tests[0].diagnostic.line, 3);
  assert.equal(decideCompletion(fail).decision, 'RECOVERY_REQUIRED');
});

test('green export gate with uninspected accessibility requirement remains unverified', () => {
  const sparse = validateControllerContext({ schemaVersion: 1, taskId: 'task', stage: 'final',
    originalTask: context.originalTask, suite: { id: 'suite', version: 'v1', digest,
      gates: [{ id: 'EXPORT', requirementIds: ['export'], testIds: ['export pass'] }] },
    sourceSnapshot: sha }, 'final');
  const input = { schemaVersion: 2, taskId: 'task', runId: 'run-sparse', stage: 'final', snapshotIdentity: sha,
    suite: { id: 'suite', version: 'v1', digest }, execution: { exitCode: 0 },
    testCounts: { executed: 1, skipped: 0, passed: 1, failed: 0 },
    gates: [{ id: 'EXPORT', tests: [{ id: 'export pass', result: 'PASS', evidence: 'Vitest passed' }] }] };
  assert.equal(decideCompletion(normalizeGateReport(input, sparse)).decision, 'UNVERIFIED');
});

test('skips, missing, duplicates, suite and source drift, spoofed counts and invalid injected reports block or stay unverified', () => {
  assert.equal(normalize(envelope('pending')).gates[1].result, 'UNVERIFIED');
  const changes = [
    v => { v.vitest.testResults[0].assertionResults.pop(); v.vitest.numTotalTests--; v.vitest.numPassedTests--; },
    v => { v.vitest.testResults[0].assertionResults[1].fullName = 'export pass'; },
    v => { v.snapshotIdentity = 'c'.repeat(64); },
    v => { v.suite.digest = 'c'.repeat(64); },
    v => { v.vitest.numPassedTests = 20; },
    v => { v.vitest.testResults = []; },
    v => { v.vitest.testResults[0].status = 'crashed'; },
    v => { v.execution.exitCode = 1; },
  ];
  for (const change of changes) {
    const value = envelope(); change(value);
    assert.throws(() => normalize(value), /Blocked/);
  }
  const invalid = { schemaVersion: 2, taskId: 'task', runId: 'run-1', stage: 'final', snapshotIdentity: sha,
    suite: { id: 'suite', version: 'v1', digest }, execution: { exitCode: 0 },
    testCounts: { executed: 2, skipped: 0, passed: 2, failed: 0 }, gates: [
      { id: 'EXPORT', tests: [{ id: 'export pass', result: 'PASS', evidence: 'pass' }] },
      { id: 'A11Y', tests: [{ id: 'accessibility fail', result: 'SKIP', evidence: '' }] },
    ] };
  assert.throws(() => normalizeGateReport(invalid, context), /spoofed test counts/);
});
