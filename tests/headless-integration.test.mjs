import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultResourceLoader, createAgentSession, SessionManager, SettingsManager }
  from '@earendil-works/pi-coding-agent';
import { EvidenceBroker } from '../src/broker.ts';
import { validateControllerContext } from '../src/controller-context.ts';
import { selectCheckpoint, checkpointContext } from '../src/checkpoints.ts';
import { adaptVitestReport } from '../src/vitest-report.ts';
import { normalizeGateReport } from '../src/gates.ts';
import { runInspectionAnalysis } from '../src/analysis.ts';
import { applyRecoveryAnalysis, createRecoveryPlan, decideCompletion, validateRequirementReview }
  from '../src/completion.ts';
import { McpReadDispatcher, mcpSchemaDigest } from '../src/mcp-read.ts';
import { approvedVerifier } from '../src/verifier.ts';

const run = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(packageRoot, 'tests/fixtures/headless');
const digest = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);

function provider(source) {
  return { capabilities: new Set(['read_source']), resourceScopes: { read_source: [source] },
    acceptSnapshotPath: path => path === source,
    inspect: async (snapshot, request) => ({ capability: request.capability, path: request.path,
      ok: true, trust: 'untrusted_project_evidence', evidence: { text: await readFile(join(snapshot, request.path), 'utf8') } }),
    validate: async () => ({ facts: {}, errors: [] }) };
}

function controller(fixture, snapshot, suiteDigest) {
  return validateControllerContext({ schemaVersion: 1, taskId: fixture.taskId, stage: 'final',
    originalTask: { text: fixture.task, reference: `controller:${fixture.taskId}`, version: 'v1',
      requirements: fixture.requirements },
    suite: { id: `${fixture.taskId}-protected`, version: 'v1', digest: suiteDigest, gates: [
      { id: fixture.gate, requirementIds: [fixture.requirements[0].id], testIds: [fixture.test] },
      { id: 'REGRESSION', requirementIds: [fixture.requirements[1].id], testIds: [`${fixture.taskId} regression`] },
    ] }, sourceSnapshot: snapshot }, 'final');
}

// The controller fixture emits the documented Vitest JSON shape. It deliberately does
// not claim to have run the Vitest CLI; this exercises the production adapter path.
function reporter(fixture, context, repaired, runId) {
  const failed = repaired ? 0 : 1;
  const assertions = [
    { fullName: fixture.test, status: repaired ? 'passed' : 'failed', failureMessages: repaired ? [] :
      [`AssertionError: ${fixture.assertion}\n    at /suite/${fixture.taskId}.test.ts:4:1`] },
    { fullName: `${fixture.taskId} regression`, status: 'passed', failureMessages: [] },
  ];
  return { format: 'vitest-json', taskId: context.taskId, runId, stage: context.stage,
    snapshotIdentity: context.sourceSnapshot,
    suite: { id: context.suite.id, version: context.suite.version, digest: context.suite.digest },
    execution: { exitCode: failed },
    vitest: { success: !failed, numTotalTestSuites: 1, numPassedTestSuites: failed ? 0 : 1,
      numFailedTestSuites: failed, numPendingTestSuites: 0, numTotalTests: 2,
      numPassedTests: 2 - failed, numFailedTests: failed, numPendingTests: 0, numTodoTests: 0,
      testResults: [{ name: `/suite/${fixture.taskId}.test.ts`, status: failed ? 'failed' : 'passed', assertionResults: assertions }] } };
}

function normalized(fixture, context, repaired, runId, previous, reason = 'final') {
  const checkpoint = selectCheckpoint(context, { reason, milestoneId: 'final', gateIds: context.suite.gates.map(g => g.id) }, previous);
  const report = normalizeGateReport(adaptVitestReport(reporter(fixture, context, repaired, runId),
    checkpointContext(context, checkpoint)), checkpointContext(context, checkpoint), previous);
  report.checkpoint = { ...checkpoint, runId };
  return report;
}

async function requirementReview(context, report, broker, fixture, quote) {
  const inspected = await broker.inspectSnapshot(report.snapshotIdentity,
    [{ capability: 'read_source', path: fixture.source }], undefined,
    { taskId: context.taskId, turnId: report.runId });
  assert.ok(inspected[0].evidence.text.includes(quote));
  const finding = (requirement, citation) => ({ id: requirement.id, status: 'VERIFIED',
    reason: `Source inspection shows ${requirement.id}`, limitations: [],
    evidence: [{ path: fixture.source, line: 1, quote: citation, receipt: inspected[0].receipt }] });
  return validateRequirementReview({ taskId: context.taskId, stage: context.stage,
    milestoneId: report.checkpoint.milestoneId, sourceSnapshot: report.snapshotIdentity,
    suite: context.suite, runId: report.runId,
    findings: context.originalTask.requirements.map((req, index) => finding(req, index ?
      fixture.taskId === 'invoice-ts' ? "currency = 'USD'" : 'title.lower()' : quote)) }, context, report);
}

test('two unrelated controller fixtures fail, receive scoped advice, get a worker repair, then pass with independent review', async t => {
  for (const name of ['ts', 'python']) await t.test(name, async () => {
    const fixtureBytes = await readFile(join(fixtures, `${name}.json`));
    const fixture = JSON.parse(fixtureBytes);
    const root = await mkdtemp(join(tmpdir(), `pi-sitter-${name}-project-`));
    const file = join(root, fixture.source);
    try {
      await writeFile(file, fixture.before);
      const broker = new EvidenceBroker(root, provider(fixture.source));
      const initial = await broker.openSnapshot();
      const firstSource = initial.identity;
      await initial.close();
      const firstContext = controller(fixture, firstSource, digest(fixtureBytes));
      const failed = normalized(fixture, firstContext, false, `${name}-failed`);
      assert.equal(failed.gates[0].result, 'FAIL');
      assert.equal(decideCompletion(failed, undefined, firstContext).decision, 'RECOVERY_REQUIRED');
      let calls = 0;
      const investigation = await runInspectionAnalysis(failed, broker, async () => ({ text: JSON.stringify(++calls === 1 ?
        { requests: [{ capability: 'read_source', path: fixture.source }] } :
        { cause: `Saved ${fixture.source} omits required transformation`, confidence: 0.9,
          uncertainty: 'The approved rerun must confirm behavior', affected: [{ path: fixture.source }],
          steps: [`Repair ${fixture.source} in the worker project`], evidenceRefs: [
            { kind: 'failed_test', gateId: fixture.gate, testId: fixture.test, quote: fixture.assertion },
            { kind: 'inspection', index: 0, quote: fixture.brokenQuote },
          ] }) }));
      assert.equal(investigation.kind, 'ready');
      assert.equal(calls, 2);
      const plan = applyRecoveryAnalysis(createRecoveryPlan(failed, fixture.task), failed, investigation);
      assert.equal(plan.diagnosis.status, 'SUPPORTED');
      assert.deepEqual(plan.diagnosis.verification.gateIds, [fixture.gate]);
      // This write represents the worker's repair. No Pi Sitter API performs it.
      await writeFile(file, fixture.after);
      const fresh = await broker.openSnapshot();
      const secondSource = fresh.identity;
      await fresh.close();
      assert.notEqual(secondSource, firstSource);
      const secondContext = controller(fixture, secondSource, digest(fixtureBytes));
      const passed = normalized(fixture, secondContext, true, `${name}-rerun`, failed, 'post_repair');
      assert.ok(passed.gates.every(gate => gate.result === 'PASS'));
      assert.equal(decideCompletion(passed, undefined, secondContext).decision, 'UNVERIFIED');
      const review = await requirementReview(secondContext, passed, broker, fixture, fixture.repairedQuote);
      assert.equal(decideCompletion(passed, undefined, secondContext, review).decision, 'VERIFIED');
      assert.equal(await readFile(file, 'utf8'), fixture.after);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test('malformed, stale, missing-requirement and blocked replay evidence fail closed', async () => {
  const fixtureBytes = await readFile(join(fixtures, 'ts.json'));
  const fixture = JSON.parse(fixtureBytes);
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-negative-'));
  try {
    await writeFile(join(root, fixture.source), fixture.after);
    const broker = new EvidenceBroker(root, provider(fixture.source));
    const snapshot = await broker.openSnapshot();
    const context = controller(fixture, snapshot.identity, digest(fixtureBytes));
    await snapshot.close();
    const good = reporter(fixture, context, true, 'good');
    for (const mutation of [
      value => { value.snapshotIdentity = '0'.repeat(64); },
      value => { value.vitest.testResults = []; },
      value => { value.vitest.testResults[0].assertionResults = []; },
      value => { value.vitest.testResults[0].assertionResults[0].fullName = 'unknown'; },
      value => { value.vitest.numPassedTests = 99; },
    ]) { const candidate = clone(good); mutation(candidate); assert.throws(() => adaptVitestReport(candidate, context), /Blocked/); }
    assert.throws(() => adaptVitestReport({}, context), /Blocked/);
    const passed = normalized(fixture, context, true, 'good');
    const review = await requirementReview(context, passed, broker, fixture, fixture.repairedQuote);
    const absent = { ...review, findings: review.findings.slice(0, 1) };
    assert.equal(decideCompletion(passed, undefined, context, absent).decision, 'UNVERIFIED');
    assert.equal(decideCompletion(undefined, 'sandbox unavailable', context, review).decision, 'BLOCKED');
    assert.throws(() => normalizeGateReport(adaptVitestReport(good, context), context, passed), /stale run identity/);
    await writeFile(join(root, fixture.source), fixture.before);
    await assert.rejects(broker.inspectSnapshot(context.sourceSnapshot,
      [{ capability: 'read_source', path: fixture.source }], undefined,
      { taskId: context.taskId, turnId: passed.runId }), /project changed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('malicious MCP annotations and indirect routes cannot dispatch mutation', async () => {
  const schema = { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] };
  const read = { name: 'mcp__fixture__read', sourceInfo: { path: 'trusted:mcp' }, parameters: schema,
    annotations: { readOnlyHint: true } };
  const write = { ...read, name: 'mcp__fixture__write', annotations: { readOnlyHint: true } };
  let calls = 0;
  const receipts = [];
  const host = { taskId: 'task', turnId: 'turn', sourceIdentity: 'source', getWorkerTools: () => [read, write],
    getWorkerServerIdentity: () => 'controlled-server', record: receipt => receipts.push(receipt),
    operations: [{ name: read.name, serverIdentity: 'controlled-server', sourcePath: 'trusted:mcp',
      schemaDigest: mcpSchemaDigest(schema), resourceScopes: ['fixture://public'],
      authorize: async args => {
        if (Object.keys(args).join(',') !== 'path' || args.path !== 'public') throw Error('mutation route');
        return { resource: 'fixture://public', args: { path: 'public' } };
      }, execute: async () => { calls++; return { content: [{ type: 'text', text: 'public' }] }; },
      sanitize: result => result.content[0].text }] };
  const dispatcher = new McpReadDispatcher(host);
  assert.equal(await dispatcher.dispatch(read.name, { path: 'public' }), 'public');
  await assert.rejects(dispatcher.dispatch(write.name, { path: 'public' }), /denied/);
  await assert.rejects(dispatcher.dispatch(read.name, { path: 'public', nested: { name: write.name } }), /denied/);
  await assert.rejects(dispatcher.dispatch(read.name, { path: 'public', route: 'shell' }), /denied/);
  assert.equal(calls, 1);
  assert.deepEqual(receipts.map(receipt => receipt.status), ['allowed', 'denied', 'denied', 'denied']);
});

test('unsupported sandbox plan is rejected before execution', () => {
  assert.throws(() => approvedVerifier({ id: 'unsafe', executable: process.execPath, args: [],
    sourcePath: '/', suitePath: '/', runtimePaths: ['/'] }), /invalid trusted execution plan/);
});

test('npm tarball installs and Pi loads src/index.ts from two unrelated projects', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-pack-'));
  try {
    const packed = await run('npm', ['pack', '--silent', '--pack-destination', root], { cwd: packageRoot });
    const tarball = join(root, packed.stdout.trim().split('\n').at(-1));
    assert.match(tarball, /pi-sitter-0\.1\.[0-9]+\.tgz$/);
    for (const name of ['ts', 'python']) await t.test(name, async () => {
      const project = join(root, `${name}-consumer`);
      const agentDir = join(project, '.agent');
      await mkdir(project);
      await mkdir(agentDir);
      await writeFile(join(project, 'package.json'), JSON.stringify({ name: `${name}-consumer`, private: true, type: 'module' }));
      await run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock',
        '@earendil-works/pi-coding-agent@1.5.2', 'typebox@1.4.7', tarball], { cwd: project, timeout: 120_000 });
      const installed = join(project, 'node_modules/pi-sitter');
      const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
      assert.deepEqual(manifest.pi.extensions, ['./src/index.ts']);
      assert.equal(manifest.exports['.'], './src/index.ts');
      assert.match(await readFile(join(installed, 'src/index.ts'), 'utf8'), /createPiSitter/);
      const loader = new DefaultResourceLoader({ cwd: project, agentDir,
        additionalExtensionPaths: [installed], noExtensions: true, noSkills: true,
        noPromptTemplates: true, noThemes: true, noContextFiles: true });
      await loader.reload();
      const { session } = await createAgentSession({ cwd: project, agentDir, resourceLoader: loader,
        settingsManager: SettingsManager.create(project, agentDir), sessionManager: SessionManager.inMemory(project) });
      try {
        await session.bindExtensions({});
        const runner = session.extensionRunner;
        assert.ok(runner.getExtensionPaths().some(path => path === join(installed, 'src/index.ts')));
        assert.ok(runner.getRegisteredCommands().some(command => command.name === 'sitter'));
        assert.equal(session.agent.state.messages.length, 0);
      } finally { session.dispose(); }
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
