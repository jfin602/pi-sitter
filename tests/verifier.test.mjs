import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredVerifier } from '../src/verifier.ts';

test('host configured verifier runs in a read-only project sandbox', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-project-'));
  try {
    const runner = join(root, 'verify.mjs');
    await writeFile(join(root, 'source.txt'), 'unchanged');
    await writeFile(runner, `import { writeFileSync } from 'node:fs';
let blocked = false;
try { writeFileSync(process.env.PI_SITTER_PROJECT_ROOT + '/source.txt', 'changed'); } catch { blocked = true; }
if (!blocked) throw Error('project was writable');
console.log(JSON.stringify({ schemaVersion: 1, stage: process.env.PI_SITTER_STAGE,
  snapshotIdentity: 'a'.repeat(64), snapshotFiles: 1, source: 'explicit',
  counts: { PASS: 1, FAIL: 0, UNVERIFIED: 0 }, regressions: [], missingDeliverables: [],
  validationLimitations: [], gates: [{ id: 'SAVED', requirement: 'saved source exists',
  fromStage: process.env.PI_SITTER_STAGE, result: 'PASS', evidence: 'source.txt exists', explanation: '',
  source: { path: 'task', line: 1, promptSha256: 'a'.repeat(64), sourcePrompt: 'Check source' },
  method: { kind: 'fixture', fact: 'source' } }] }));`);
    const verify = configuredVerifier(JSON.stringify([process.execPath, runner]));
    const report = await verify('current', root, {});
    assert.equal(report.counts.PASS, 1);
    assert.equal(await readFile(join(root, 'source.txt'), 'utf8'), 'unchanged');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('verification command rejects shell strings and relative executables', () => {
  assert.throws(() => configuredVerifier('rm -rf /'), /JSON string array/);
  assert.throws(() => configuredVerifier(JSON.stringify(['node', 'verify.mjs'])), /absolute executable/);
});
