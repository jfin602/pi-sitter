import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInspectionAnalysis } from '../src/analysis.ts';
import { EvidenceBroker } from '../src/broker.ts';

const report = { schemaVersion: 1, stage: 'task', snapshotIdentity: 'a'.repeat(64), snapshotFiles: 1,
  source: 'explicit', counts: { PASS: 0, FAIL: 1, UNVERIFIED: 0 }, regressions: [], missingDeliverables: ['GATE-A'],
  validationLimitations: [], gates: [{ id: 'GATE-A', requirement: 'Saved behavior works', result: 'FAIL',
    evidence: 'Actual saved output is wrong', explanation: '', fromStage: 'task', method: { kind: 'evidence_fact', fact: 'behavior' },
    source: { path: 'prompt.md', line: 1, promptSha256: 'a'.repeat(64), sourcePrompt: 'Prompt' } }] };

test('analysis requests bounded broker inspection tied to the same snapshot', async () => {
  let calls = 0, observed;
  const broker = { inspectSnapshot: async (identity, requests) => {
    assert.equal(identity, report.snapshotIdentity);
    assert.deepEqual(requests, [{ capability: 'read_source', path: 'main.ts' }]);
    return [{ capability: 'read_source', path: 'main.ts', ok: true, trust: 'untrusted_project_evidence', evidence: { text: 'wrong branch selected' } }];
  } };
  const answer = async () => ({ text: ++calls === 1
    ? JSON.stringify({ requests: [{ capability: 'read_source', path: 'main.ts' }] })
    : JSON.stringify({ action: 'Correct the branch condition in the saved source', evidenceRefs: [{ kind: 'inspection', index: 0, quote: 'wrong branch selected' }] }), inputTokens: 20, outputTokens: 10 });
  const result = await runInspectionAnalysis(report, broker, answer, undefined,
    { onInspections: (requests, results) => { observed = [requests, results]; } });
  assert.equal(result.kind, 'ready');
  assert.equal(result.calls, 2);
  assert.equal(result.inputTokens, 40);
  assert.equal(observed[1].length, 1);
});

test('analysis timeout, malformed response, and unsupported evidence fail without authorizing action', async () => {
  const broker = { inspectSnapshot: async () => { throw Error('should not inspect'); } };
  const timeout = await runInspectionAnalysis(report, broker, () => new Promise(() => {}), undefined, { timeoutMs: 10 });
  assert.equal(timeout.kind, 'timeout');
  assert.equal(timeout.calls, 1);
  const malformed = await runInspectionAnalysis(report, broker, async () => ({ text: 'not JSON' }));
  assert.equal(malformed.kind, 'failed');
  const ungrounded = await runInspectionAnalysis(report, broker, async () => ({ text: JSON.stringify({ action: 'Delete everything', evidence: 'not observed' }) }));
  assert.equal(ungrounded.kind, 'abstained');
});

test('provider errors and model receipt text do not ground a repair', async () => {
  const broker = { inspectSnapshot: async () => [{ capability: 'read_source', path: 'main.ts', ok: false,
    trust: 'untrusted_project_evidence', error: 'secret branch is wrong' }] };
  let calls = 0;
  const answer = async () => ({ text: ++calls === 1
    ? JSON.stringify({ requests: [{ capability: 'read_source', path: 'main.ts' }] })
    : JSON.stringify({ action: 'Change branch', evidence: 'secret branch is wrong' }),
    evidence: ['secret branch is wrong'] });
  const result = await runInspectionAnalysis(report, broker, answer);
  assert.equal(result.kind, 'abstained');
});

test('generic broker routes TypeScript, Rust, and Python files through a provider without framework knowledge', async () => {
  const root = await mkdtemp(join(tmpdir(), 'twin-generic-'));
  try {
    for (const name of ['main.ts', 'main.rs', 'main.py']) await writeFile(join(root, name), `saved ${name}`);
    const provider = { capabilities: new Set(['read_source']), resourceScopes: { read_source: ['main.ts', 'main.rs', 'main.py'] },
      acceptSnapshotPath: (path, directory) => !directory && /\.(?:ts|rs|py)$/.test(path),
      inspect: async (snapshot, request) => ({ capability: request.capability, path: request.path, ok: true,
        trust: 'untrusted_project_evidence', evidence: { text: await readFile(join(snapshot, request.path), 'utf8') } }),
      validate: async () => ({ facts: { 'source.saved': { result: 'PASS', evidence: 'Three saved source files inspected' } }, errors: [] }) };
    const broker = new EvidenceBroker(root, provider);
    const checked = await broker.runValidator();
    assert.equal(checked.files, 3);
    const results = await broker.inspectSnapshot(checked.identity, [
      { capability: 'read_source', path: 'main.ts' }, { capability: 'read_source', path: 'main.rs' },
      { capability: 'read_source', path: 'main.py' } ]);
    assert.deepEqual(results.map(item => item.evidence.text), ['saved main.ts', 'saved main.rs', 'saved main.py']);
    await assert.rejects(broker.executeRequests([{ capability: 'read_source', path: '../outside.py' }]), /path traversal/);
    assert.equal(await readFile(join(root, 'main.rs'), 'utf8'), 'saved main.rs');
  } finally { await rm(root, { recursive: true, force: true }); }
});
