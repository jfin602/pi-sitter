import test from 'node:test';
import assert from 'node:assert/strict';
import { link, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approvedVerifier, configuredVerifier } from '../src/verifier.ts';
import { validateControllerContext } from '../src/controller-context.ts';
import { normalizeGateReport } from '../src/gates.ts';

const sha = 'a'.repeat(64), digest = 'b'.repeat(64);
const context = validateControllerContext({ schemaVersion: 1, taskId: 'fixture', stage: 'current',
  originalTask: { text: 'Check behavior', reference: 'task', version: 'v1',
    requirements: [{ id: 'R', text: 'Check behavior' }] },
  suite: { id: 'suite', version: 'v1', digest,
    gates: [{ id: 'G', requirementIds: ['R'], testIds: ['T'] }] }, sourceSnapshot: sha }, 'current');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-fixture-'));
  const source = join(root, 'source'), suite = join(root, 'suite'), live = join(root, 'live');
  await Promise.all([mkdir(source), mkdir(suite), mkdir(live)]);
  await writeFile(join(source, 'source.txt'), 'unchanged');
  await writeFile(join(suite, 'verify.mjs'), `import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
const mode = process.argv[2];
if (mode === 'malformed') { console.log('{bad json'); process.exit(1); }
if (mode === 'stdout') { await new Promise(resolve => process.stdout.write('x'.repeat(2_000_000), resolve)); process.exit(0); }
if (mode === 'filelimit') { writeFileSync('/scratch/huge', Buffer.alloc(20_000_000)); process.exit(0); }
if (mode === 'timeout') { await new Promise(resolve => setTimeout(resolve, 10000)); }
if (mode === 'timeout-tree') {
  spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000); /*pi-sitter-orphan-probe*/'], { stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 10000));
}
if (mode === 'filecount') {
  for (let i = 0; i < 1100; i++) writeFileSync('/scratch/f' + i, '');
}
let evidence = 'assertion evidence';
if (mode === 'isolation') {
  let sourceBlocked = false, suiteBlocked = false;
  try { writeFileSync('/source/source.txt', 'changed'); } catch { sourceBlocked = true; }
  try { writeFileSync('/suite/verify.mjs', 'changed'); } catch { suiteBlocked = true; }
  writeFileSync('/scratch/proof', 'scratch writable');
  if (!sourceBlocked || !suiteBlocked || existsSync('/etc/passwd') ||
      readFileSync('/source/source.txt', 'utf8') !== 'unchanged') throw Error('isolation failed');
  evidence = 'source and suite protected; secret absent; scratch writable';
}
if (mode === 'network') {
  const socket = connect({ host: '1.1.1.1', port: 53 });
  evidence = await new Promise(resolve => { socket.on('error', error => resolve(error.code)); socket.on('connect', () => resolve('network connected')); });
  socket.destroy();
  if (evidence !== 'ENETUNREACH') throw Error(evidence);
}
const result = mode === 'fail' || mode === 'crash' ? 'FAIL' : 'PASS';
console.log(JSON.stringify({ schemaVersion: 2, taskId: 'fixture', runId: 'run-1', stage: process.env.PI_SITTER_STAGE,
 snapshotIdentity: '${sha}', suite: { id: 'suite', version: 'v1', digest: '${digest}' },
 testCounts: { executed: 1, skipped: 0, passed: result === 'PASS' ? 1 : 0, failed: result === 'FAIL' ? 1 : 0 },
 execution: { exitCode: mode === 'crash' ? 2 : result === 'FAIL' ? 1 : 0 },
 gates: [{ id: 'G', tests: [{ id: 'T', result, evidence }] }] }));
process.exit(mode === 'crash' ? 2 : result === 'FAIL' ? 1 : 0);`);
  const plan = mode => ({ id: 'approved', executable: process.execPath,
    args: ['/suite/verify.mjs', mode], sourcePath: source, suitePath: suite,
    runtimePaths: ['/usr/lib', '/usr/lib64'], timeoutMs: 1000 });
  return { root, source, suite, live, plan };
}

test('approved source and suite are read-only; host secrets absent; scratch writable', async () => {
  const f = await fixture();
  try {
    const report = await approvedVerifier(f.plan('isolation'))('current', f.live, {});
    assert.equal(normalizeGateReport(report, context).gates[0].result, 'PASS');
    assert.match(report.gates[0].tests[0].evidence, /scratch writable/);
    assert.equal(await readFile(join(f.source, 'source.txt'), 'utf8'), 'unchanged');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('plan IDs require host resolution; shell arrays, aliases and unapproved mounts block', async () => {
  const f = await fixture();
  try {
    assert.throws(() => configuredVerifier(JSON.stringify(['/bin/sh', '-c', 'id'])), /trusted approved verifier/);
    await assert.rejects(configuredVerifier(JSON.stringify('approved'))('current', f.live, {}), /approved plan unavailable/);
    assert.ok(configuredVerifier(JSON.stringify('approved'), id => id === 'approved' ? f.plan('isolation') : undefined));
    const literal = await approvedVerifier(f.plan('; touch /source/injected'))('current', f.live, {});
    assert.equal(normalizeGateReport(literal, context).gates[0].result, 'PASS');
    assert.equal((await readdir(f.source)).includes('injected'), false);
    assert.throws(() => approvedVerifier({ ...f.plan('isolation'), runtimePaths: ['/'] }), /invalid trusted execution plan/);
    assert.throws(() => approvedVerifier({ ...f.plan('isolation'), sourcePath: f.root + '/../etc' }),
      /invalid trusted execution plan/);
    assert.throws(() => approvedVerifier({ ...f.plan('isolation'), environment: { PI_SITTER_PROJECT_ROOT: '/etc' } }),
      /invalid trusted execution plan/);
    await assert.rejects(approvedVerifier({ ...f.plan('isolation'), sourcePath: '/' })('current', f.live, {}), /broad source/);
    await assert.rejects(approvedVerifier({ ...f.plan('isolation'), sourcePath: f.live })('current', f.live, {}), /live project/);
    await symlink('/etc', join(f.source, 'escape'));
    await assert.rejects(approvedVerifier(f.plan('isolation'))('current', f.live, {}), /link\/special file denied/);
    await rm(join(f.source, 'escape'));
    await link(join(f.source, 'source.txt'), join(f.source, 'hardlink'));
    await assert.rejects(approvedVerifier(f.plan('isolation'))('current', f.live, {}), /link\/special file denied/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('the resolved plan must match trusted task, suite, source, and gate subset', async () => {
  const f = await fixture();
  const checkpoint = { reason: 'final', taskId: 'fixture', milestoneId: 'final', snapshotId: sha,
    suiteId: 'suite', suiteDigest: digest, gateIds: ['G'] };
  try {
    const selected = { ...f.plan('isolation'), taskId: 'fixture', suiteDigest: digest,
      sourceSnapshot: sha, gateIds: ['G'] };
    const verify = configuredVerifier(JSON.stringify('approved'), () => selected);
    assert.equal(normalizeGateReport(await verify('current', f.live, { checkpoint }), context).gates[0].result, 'PASS');
    await assert.rejects(approvedVerifier({ ...selected, gateIds: ['other'] })('current', f.live,
      { checkpoint }), /does not match checkpoint/);
    await assert.rejects(approvedVerifier({ ...selected, sourceSnapshot: 'd'.repeat(64) })('current', f.live,
      { checkpoint }), /does not match checkpoint/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('assertion failure is FAIL; crash and malformed report are BLOCKED', async () => {
  const f = await fixture();
  try {
    const run = mode => approvedVerifier(f.plan(mode))('current', f.live, {});
    assert.equal(normalizeGateReport(await run('fail'), context).gates[0].result, 'FAIL');
    await assert.rejects(run('crash'), /sandbox or runner exit 2/);
    await assert.rejects(run('malformed'), /malformed machine-readable report/);
    await assert.rejects(run('stdout'), /stdout limit/);
    await assert.rejects(run('filelimit'), /malformed machine-readable report|sandbox or runner exit/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('network is denied and timeout/cancel kill the sandbox and remove scratch', async () => {
  const f = await fixture();
  const prefix = `pi-sitter-view-${process.pid}-`;
  const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith(prefix)));
  try {
    assert.equal(normalizeGateReport(await approvedVerifier(f.plan('network'))('current', f.live, {}), context).gates[0].result, 'PASS');
    await assert.rejects(approvedVerifier({ ...f.plan('timeout'), timeoutMs: 30 })('current', f.live, {}), /wall-clock timeout/);
    await assert.rejects(approvedVerifier({ ...f.plan('timeout-tree'), timeoutMs: 80 })('current', f.live, {}), /wall-clock timeout/);
    const proc = (await readdir('/proc')).filter(name => /^\d+$/.test(name));
    const orphan = (await Promise.all(proc.map(async pid => {
      try { return (await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes('pi-sitter-orphan-probe'); }
      catch { return false; }
    }))).some(Boolean);
    assert.equal(orphan, false);
    await assert.rejects(approvedVerifier(f.plan('timeout'))('current', f.live,
      { signal: AbortSignal.timeout(30) }), /canceled/);
    const after = (await readdir(tmpdir())).filter(name => name.startsWith(prefix));
    assert.deepEqual(after.filter(name => !before.has(name)), []);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('scratch file count limit blocks excessive file creation', async () => {
  const f = await fixture();
  try {
    await assert.rejects(approvedVerifier(f.plan('filecount'))('current', f.live, {}), /sandbox or runner exit 70/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
