import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildPlan, assertVersionCompatible, detectCompletedPromptPrefix, promptCommitSubject, roadmapVersionFor }
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
test('Pi Sitter manifest stays on a historical p1 checkpoint or the owner milestone without a root package lock', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'pi-sitter');
  const plan = await livePlan();
  const allowed = [roadmapVersionFor(plan, 0), ...plan.prompts.map(prompt => prompt.targetVersion), '0.2.0', '0.2.1', '0.2.2', '0.2.3', '0.2.4', '0.2.5'];
  assert.ok(allowed.includes(pkg.version), `unexpected package checkpoint ${pkg.version}`);
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
async function liveEntries() {
  const directory = path.join(root, 'docs/tasks/p1');
  const names = (await readdir(directory)).filter(name => name.endsWith('.txt') || /^P\d/.test(name));
  assert.equal(names.length, 10, 'expected the ten authored p1 prompt texts');
  assert.ok(names.every(name => /^P(?:[1-9]\d*)-[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/.test(name)),
    `unexpected prompt filename: ${names.join(', ')}`);
  return Promise.all(names.map(async filename => ({ filename, text: await readFile(path.join(directory, filename), 'utf8') })));
}

function checkedPlan(entries) {
  const plan = buildPlan(entries, 'p1');
  assert.equal(plan.prompts.length, 10);
  assert.equal(plan.closeout.number, 10);
  assert.equal(plan.closeout.browserRequired, true, 'final closeout must require a browser');
  assert.ok(plan.implementations.every(prompt => !prompt.browserRequired));
  return plan;
}

async function livePlan() { return checkedPlan(await liveEntries()); }

test('authored p1 stack obeys unchanged runner grammar and ends in one browser-gated manual closeout', async () => {
  const plan = await livePlan();
  assert.equal(plan.phase, 1);
  assert.equal(plan.mode, 'phase');
  assert.deepEqual(plan.prompts.map(prompt => prompt.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(plan.prompts.map(prompt => prompt.targetVersion),
    Array.from({ length: 10 }, (_, index) => `0.1.${index + 1}`));
  assert.equal(plan.implementations.length, 9);
  assert.equal(plan.closeout.number, 10);
  assert.equal(plan.closeout.kind, 'closeout');
  assert.equal(plan.closeout.browserRequired, true);
  assert.ok(plan.implementations.every(prompt => prompt.kind === 'implementation' && !prompt.browserRequired));
});

test('p1 compatibility rejects wrong versions, broken grammar, wrong phase and filenames', async () => {
  const entries = await liveEntries();
  const plan = checkedPlan(entries);
  const allowed = [roadmapVersionFor(plan, 0), ...plan.prompts.map(prompt => prompt.targetVersion)];
  for (const version of ['0.0.1', '0.2.1', '0.1.11', '1.1.1', '0.1.01']) {
    assert.ok(!allowed.includes(version), version);
  }
  const p1 = entries.find(entry => entry.filename.startsWith('P1-'));
  const p2 = entries.find(entry => entry.filename.startsWith('P2-'));
  const p10 = entries.find(entry => entry.filename.startsWith('P10-'));
  const changed = (filename, replacement) => entries.map(entry => entry.filename === filename ? { ...entry, ...replacement } : entry);
  assert.throws(() => buildPlan(changed(p1.filename, { text: p1.text.replace('Phase 1 / P1', 'Phase 2 / P1') }), 'p1'));
  assert.throws(() => buildPlan(changed(p1.filename, { text: p1.text.replace('Recommended configuration:', 'Recommended model:') }), 'p1'));
  assert.throws(() => buildPlan(changed(p1.filename, { filename: 'P01-bad.txt' }), 'p1'));
  assert.throws(() => checkedPlan(changed(p10.filename, { text: p10.text.replace('Browser required: yes.', 'Browser required: no.') })),
    /browser/);
  assert.throws(() => buildPlan(changed(p2.filename, { text: p2.text.replace('`0.1.2`', '`0.1.12`') }), 'p1'));
});
