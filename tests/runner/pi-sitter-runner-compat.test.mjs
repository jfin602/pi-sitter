import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildPlan, assertVersionCompatible, detectCompletedPromptPrefix, promptCommitSubject }
  from '../../scripts/codex-phase-core.mjs';

// Canonical jfin602/dope Git blob SHAs as independently recorded by Vault (2026-11-21).
const DOPE_SOURCE_BLOBS = Object.freeze({
  'codex-phase-core.mjs': 'c8dd92048229d66bcdf62411cec5f744659ec743',
  'codex-phase.mjs': '0531ddcce2802b0ea42bc6bdfb91a1a09def668f',
  'validate-codex-phase.mjs': '510779ba61904df1ba1537dab9e59d53c6499e4c',
});
const root = process.cwd();
test('Dope phase runner and validator stay byte-for-byte unchanged', async () => {
  for (const [filename, sha] of Object.entries(DOPE_SOURCE_BLOBS)) {
    const bytes = await readFile(path.join(root, 'scripts', filename));
    const digest = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
    assert.equal(digest, sha, filename);
  }
});
test('Pi Sitter development runner uses existing 0.1.0 manifest and no root package lock', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'pi-sitter');
  assert.equal(pkg.version, '0.1.0');
  assert.equal(pkg.pi.extensions[0], './src/index.ts');
  assert.equal(pkg.scripts['codex:phase'], 'node scripts/codex-phase.mjs');
  assert.equal(pkg.scripts['codex:phase:validate'], 'node scripts/validate-codex-phase.mjs');
  assert.match(await readFile(path.join(root, '.npmrc'), 'utf8'), /package-lock=false/);
  await assert.rejects(access(path.join(root, 'package-lock.json')), { code: 'ENOENT' });
});
test('synthetic historical p1 grammar accepts the 0.1.0 baseline and manual closeout', () => {
  const quote = String.fromCharCode(96);
  const makePrompt = (n, closeout) => ({
    filename: closeout ? 'P2-manual-closeout.txt' : 'P1-gates.txt',
    text: [
      'TASK: Phase 1 / P' + n + ' — ' + (closeout ? 'Manual closeout' : 'Gate schema'),
      '', 'MODEL / REASONING / USAGE',
      '- Recommended configuration: ' + quote + (closeout ? 'GPT-6 Sol Medium' : 'GPT-6 Sol High') + quote + '.',
      '- Browser required: ' + (closeout ? 'yes.' : 'no.'),
      '', 'VERSIONING',
      '- This prompt' + "'" + 's assigned project version is ' + quote + '0.1.' + n + quote + '.',
      '', 'GOAL', closeout ? 'Manual owner testing only.' : 'Implement gate facts.',
    ].join('\n'),
  });
  const plan = buildPlan([makePrompt(1,false), makePrompt(2,true)], 'p1');
  assert.deepEqual(plan.implementations.map(p => p.number), [1]);
  assert.equal(plan.closeout.browserRequired, true);
  assert.equal(promptCommitSubject(plan, plan.implementations[0]), '0.1.1');
  const resume = detectCompletedPromptPrefix(plan, [], '0.1.0');
  assert.equal(resume.nextPrompt.number, 1);
  assert.doesNotThrow(() => assertVersionCompatible('0.1.0', resume.nextPrompt, resume.previousVersion));
});
test('P1 task is planned and has no runnable prompt texts yet', async () => {
  const names = await readdir(path.join(root, 'docs/tasks/p1'));
  assert.equal(names.filter(n => /^P[0-9]+-.*\.txt$/.test(n)).length, 0);
});
