import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredVerifier } from '../src/verifier.ts';
import { validateControllerContext } from '../src/controller-context.ts';
import { normalizeGateReport } from '../src/gates.ts';

test('host configured verifier runs in a read-only project sandbox', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-project-'));
  try {
    const runner = join(root, 'verify.mjs');
    await writeFile(join(root, 'source.txt'), 'unchanged');
    await writeFile(runner, `import { writeFileSync } from 'node:fs';
let blocked = false;
try { writeFileSync(process.env.PI_SITTER_PROJECT_ROOT + '/source.txt', 'changed'); } catch { blocked = true; }
if (!blocked) throw Error('project was writable');
console.log(JSON.stringify({ schemaVersion: 2, taskId: 'fixture', runId: 'run-1', stage: process.env.PI_SITTER_STAGE,
  snapshotIdentity: 'a'.repeat(64), suite: { id: 'suite', version: 'v1', digest: 'b'.repeat(64) },
  testCounts: { executed: 1, skipped: 0, passed: 1, failed: 0 }, execution: { exitCode: 0 },
  gates: [{ id: 'SAVED', tests: [{ id: 'source', result: 'PASS', evidence: 'source.txt exists' }] }] }));`);
    const verify = configuredVerifier(JSON.stringify([process.execPath, runner]));
    const report = await verify('current', root, {});
    assert.equal(report.testCounts.passed, 1);
    assert.equal(await readFile(join(root, 'source.txt'), 'utf8'), 'unchanged');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('verification command rejects shell strings and relative executables', () => {
  assert.throws(() => configuredVerifier('rm -rf /'), /JSON string array/);
  assert.throws(() => configuredVerifier(JSON.stringify(['node', 'verify.mjs'])), /absolute executable/);
});

test('subprocess assertion exit is FAIL; crash, malformed output and timeout are BLOCKED', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-exits-'));
  const sha = 'a'.repeat(64), digest = 'b'.repeat(64);
  const context = validateControllerContext({ schemaVersion: 1, taskId: 'fixture', stage: 'current',
    originalTask: { text: 'Check behavior', reference: 'task', version: 'v1', requirements: [{ id: 'R', text: 'Check behavior' }] },
    suite: { id: 'suite', version: 'v1', digest, gates: [{ id: 'G', requirementIds: ['R'], testIds: ['T'] }] }, sourceSnapshot: sha }, 'current');
  try {
    const runner = join(root, 'verify.mjs');
    await writeFile(runner, `const mode = process.argv[2];
if (mode === 'malformed') { console.log('{bad json'); process.exit(1); }
if (mode === 'timeout') { await new Promise(resolve => setTimeout(resolve, 10000)); }
const result = mode === 'fail' || mode === 'crash' ? 'FAIL' : 'PASS';
console.log(JSON.stringify({ schemaVersion: 2, taskId: 'fixture', runId: 'run-1', stage: 'current',
  snapshotIdentity: '${sha}', suite: { id: 'suite', version: 'v1', digest: '${digest}' },
  testCounts: { executed: 1, skipped: 0, passed: result === 'PASS' ? 1 : 0, failed: result === 'FAIL' ? 1 : 0 },
  execution: { exitCode: mode === 'crash' ? 2 : result === 'FAIL' ? 1 : 0 },
  gates: [{ id: 'G', tests: [{ id: 'T', result, evidence: 'assertion evidence' }] }] }));
process.exit(mode === 'crash' ? 2 : result === 'FAIL' ? 1 : 0);`);
    const run = mode => configuredVerifier(JSON.stringify([process.execPath, runner, mode]))('current', root, {});
    assert.equal(normalizeGateReport(await run('fail'), context).gates[0].result, 'FAIL');
    await assert.rejects(run('crash').then(value => normalizeGateReport(value, context)), /invalid execution status/);
    await assert.rejects(run('malformed'), /malformed machine-readable/);
    const pending = configuredVerifier(JSON.stringify([process.execPath, runner, 'timeout']))('current', root,
      { signal: AbortSignal.timeout(20) });
    await assert.rejects(pending, /execution blocked/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
