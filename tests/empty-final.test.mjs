import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { createFauxCore, fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { createPiSitter } from '../src/index.ts';

const sha = 'a'.repeat(64);
const suiteDigest = 'b'.repeat(64);

function controller() {
  return { schemaVersion: 1, taskId: 'empty-final-fixture', stage: 'final',
    originalTask: { text: 'Finish the task and report checks', reference: 'controller:fixture', version: 'v1',
      requirements: [{ id: 'R1', text: 'Finish the task and report checks' }] },
    suite: { id: 'protected-suite', version: 'v1', digest: suiteDigest,
      gates: [{ id: 'G1', requirementIds: ['R1'], testIds: ['T1'] }] }, sourceSnapshot: sha };
}

function passingReport() {
  return { schemaVersion: 2, taskId: 'empty-final-fixture', runId: 'native-run-1', stage: 'final',
    snapshotIdentity: sha, suite: { id: 'protected-suite', version: 'v1', digest: suiteDigest },
    testCounts: { executed: 1, skipped: 0, passed: 1, failed: 0 }, execution: { exitCode: 0 },
    gates: [{ id: 'G1', tests: [{ id: 'T1', result: 'PASS', evidence: 'Trusted fixture assertion passed' }] }] };
}

async function nativeSession({ responses, projectTest = false, configured = false, verifiedReview = false, mode = 'active' }) {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-empty-final-'));
  const agentDir = join(root, 'agent');
  if (projectTest) await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const priorMode = process.env.PI_SITTER_MODE;
  const priorStage = process.env.PI_SITTER_STAGE;
  process.env.PI_SITTER_MODE = mode;
  process.env.PI_SITTER_STAGE = 'final';
  const faux = createFauxCore({ provider: 'empty-final-fixture' });
  faux.setResponses(responses);
  const seen = { turns: [], settles: 0, requests: [], verifies: 0 };
  const observer = pi => {
    pi.on('agent_before_settle', () => { seen.settles++; });
  };
  const deps = configured ? { loadControllerContext: controller, verify: async () => {
    seen.verifies++;
    return passingReport();
  }, ...(verifiedReview ? {
    evidenceBroker: () => ({ openSnapshot: async (_signal, { taskId, turnId }) => {
      const receipt = { taskId, turnId, tool: 'pi_sitter_inspect', operation: 'read_source',
        argsDigest: 'c'.repeat(64), sourceIdentity: sha, timestamp: new Date().toISOString(),
        status: 'allowed', resultDigest: 'd'.repeat(64), evidenceRef: `${sha}:src/task.ts` };
      return { identity: sha, inspect: async () => [{ ok: true, receipt, evidence: 'R1 source observation' }],
        close: async () => {} };
    } }),
    reviewRequirements: async (trusted, report, snapshot) => {
      const [inspected] = await snapshot.inspect([{ capability: 'read_source', path: 'src/task.ts' }]);
      return { taskId: trusted.taskId, stage: trusted.stage, milestoneId: report.checkpoint.milestoneId,
        sourceSnapshot: report.snapshotIdentity, suite: report.suite, runId: report.runId,
        findings: [{ id: 'R1', status: 'VERIFIED', reason: 'Current source inspection supports R1',
          evidence: [{ path: 'src/task.ts', line: 1, quote: 'R1 source observation', receipt: inspected.receipt }],
          limitations: [] }] };
    },
  } : {}) } : {};
  let session;
  try {
    const loader = new DefaultResourceLoader({ cwd: root, agentDir, noExtensions: true, noSkills: true,
      noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [createPiSitter(deps), observer] });
    await loader.reload();
    ({ session } = await createAgentSession({ cwd: root, agentDir, model: faux.getModel(),
      resourceLoader: loader, settingsManager: SettingsManager.create(root, agentDir),
      sessionManager: SessionManager.inMemory(root) }));
    session.agent.streamFunction = (model, context, options) => {
      seen.requests.push(context.messages);
      return faux.streamSimple(model, context, options);
    };
    session.subscribe(event => { if (event.type === 'turn_end') seen.turns.push(event.message); });
    await session.bindExtensions({});
    return { session, seen, root, close: async () => {
      session.dispose();
      faux.setResponses([]);
      await rm(root, { recursive: true, force: true });
      if (priorMode === undefined) delete process.env.PI_SITTER_MODE; else process.env.PI_SITTER_MODE = priorMode;
      if (priorStage === undefined) delete process.env.PI_SITTER_STAGE; else process.env.PI_SITTER_STAGE = priorStage;
    } };
  } catch (error) {
    session?.dispose();
    await rm(root, { recursive: true, force: true });
    if (priorMode === undefined) delete process.env.PI_SITTER_MODE; else process.env.PI_SITTER_MODE = priorMode;
    if (priorStage === undefined) delete process.env.PI_SITTER_STAGE; else process.env.PI_SITTER_STAGE = priorStage;
    throw error;
  }
}

function entries(session, type) {
  return session.sessionManager.getBranch().filter(entry => entry.type === 'custom' && entry.customType === type);
}

test('native Pi records an actionable unavailable warning before the first Worker turn', async () => {
  const h = await nativeSession({ projectTest: true, responses: [fauxAssistantMessage('Ready for host verification.')] });
  try {
    assert.equal(h.seen.turns.length, 0);
    const before = entries(h.session, 'pi-sitter-readiness');
    assert.equal(before.length, 1);
    assert.equal(before[0].data.status, 'UNAVAILABLE');
    assert.match(before[0].data.summary, /Discovered npm test/);
    assert.match(before[0].data.summary, /Run \/sitter setup/);
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 1);
    assert.equal(entries(h.session, 'pi-sitter-readiness').length, 1);
  } finally { await h.close(); }
});

test('native Pi turn_end continues an empty stop once, then agent_before_settle records unavailable verification', async () => {
  const h = await nativeSession({ projectTest: true,
    responses: [fauxAssistantMessage([]), fauxAssistantMessage('Completed checks: npm test passed.')] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 2);
    assert.equal(h.seen.settles, 1);
    assert.equal(h.seen.requests.length, 2);
    assert.match(JSON.stringify(h.seen.requests[1]), /previous turn stopped without a final report/);
    assert.equal(entries(h.session, 'pi-sitter-empty-final').filter(e => e.data.phase === 'continuing').length, 1);
    const unavailable = entries(h.session, 'pi-sitter-verification-pending').filter(e => e.data.unavailable);
    assert.equal(unavailable.length, 1);
    assert.match(unavailable[0].data.unavailable, /Discovered npm test is informational and was not run or approved/);
    assert.equal(entries(h.session, 'pi-sitter-verification-attempt').length, 0);
  } finally { await h.close(); }
});

test('native Pi repeated empty stop records a visible terminal UNVERIFIED result without a retry loop', async () => {
  const h = await nativeSession({ responses: [fauxAssistantMessage([]), fauxAssistantMessage(' \n\t ')] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 2);
    assert.equal(h.seen.settles, 1);
    const rows = entries(h.session, 'pi-sitter-empty-final');
    assert.deepEqual(rows.map(row => row.data.phase), ['continuing', 'stopped']);
    assert.equal(entries(h.session, 'pi-sitter-completion').length, 0);
    const renderer = h.session.extensionRunner.getEntryRenderer('pi-sitter-empty-final');
    const card = renderer(rows[1], { expanded: false }, { appearance: 'dark', style: text => text }).render(100);
    assert.match(card.join('\n'), /Worker stopped without a final report/);
    assert.match(card.join('\n'), /UNVERIFIED/);
  } finally { await h.close(); }
});

test('native Pi retries a whitespace-only first final response', async () => {
  const h = await nativeSession({ responses: [fauxAssistantMessage(' \n\t '), fauxAssistantMessage('Final report: checks unavailable.')] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 2);
    assert.deepEqual(entries(h.session, 'pi-sitter-empty-final').map(row => row.data.phase), ['continuing']);
  } finally { await h.close(); }
});

test('native Pi replay restores the retry marker and ignores a repeated turn_end event', async () => {
  const h = await nativeSession({ responses: [fauxAssistantMessage([]), fauxAssistantMessage('Final report supplied.')] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    const original = h.session.sessionManager.getBranch().find(entry =>
      entry.type === 'message' && entry.message.role === 'assistant' && entry.message.content.length === 0);
    assert.ok(original);
    await h.session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
    const replay = await h.session.extensionRunner.emitBoundary({ type: 'turn_end', turnIndex: 0,
      message: original.message, toolResults: [], messageEntryId: original.id,
      toolResultEntryIds: [], outcome: 'completed' }, drafts => h.session._buildBoundaryContext(drafts, 'turn_end'));
    assert.equal(replay.continue, false);
    assert.deepEqual(replay.entries, []);
    assert.equal(entries(h.session, 'pi-sitter-empty-final').length, 1);
  } finally { await h.close(); }
});

test('native Pi leaves nonempty, aborted and provider-error responses alone', async () => {
  for (const response of [fauxAssistantMessage('Done.'),
    fauxAssistantMessage([], { stopReason: 'aborted' }),
    fauxAssistantMessage([], { stopReason: 'error', errorMessage: 'Provider failed' })]) {
    const h = await nativeSession({ responses: [response] });
    try {
      await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
      assert.equal(h.seen.turns.length, 1);
      assert.equal(entries(h.session, 'pi-sitter-empty-final').length, 0);
      if (response.stopReason !== 'stop')
        assert.equal(entries(h.session, 'pi-sitter-verification-pending').filter(e => e.data.unavailable).length, 0);
    } finally { await h.close(); }
  }
});

test('native Pi no-tests completion remains unavailable without a verification attempt', async () => {
  const h = await nativeSession({ responses: [fauxAssistantMessage('Final report supplied.')] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(entries(h.session, 'pi-sitter-verification-attempt').length, 0);
    assert.equal(entries(h.session, 'pi-sitter-completion').length, 0);
    const unavailable = entries(h.session, 'pi-sitter-verification-pending').filter(e => e.data.unavailable);
    assert.equal(unavailable.length, 1);
    assert.doesNotMatch(unavailable[0].data.unavailable, /Discovered npm test/);
  } finally { await h.close(); }
});

test('native Pi configured verifier runs once after the empty-stop continuation', async () => {
  const h = await nativeSession({ configured: true, verifiedReview: true,
    responses: [fauxAssistantMessage([]), fauxAssistantMessage('Checks completed; final report supplied.')] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 2);
    assert.equal(h.seen.settles, 1);
    assert.equal(h.seen.verifies, 1);
    assert.equal(entries(h.session, 'pi-sitter-verification-attempt').length, 1);
    assert.equal(entries(h.session, 'pi-sitter-verification-pending').filter(e => e.data.unavailable).length, 0);
    assert.equal(entries(h.session, 'pi-sitter-completion').at(-1).data.decision, 'VERIFIED');
  } finally { await h.close(); }
});

test('native Pi repeated empty response still runs configured verification once without a passing completion', async () => {
  const h = await nativeSession({ configured: true, verifiedReview: true,
    responses: [fauxAssistantMessage([]), fauxAssistantMessage([])] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.verifies, 1);
    assert.equal(entries(h.session, 'pi-sitter-verification-attempt').length, 1);
    assert.deepEqual(entries(h.session, 'pi-sitter-empty-final').map(row => row.data.phase), ['continuing', 'stopped']);
    const completion = entries(h.session, 'pi-sitter-completion').at(-1).data;
    assert.equal(completion.decision, 'UNVERIFIED');
    assert.match(completion.reason, /Worker stopped without a final report/);
  } finally { await h.close(); }
});
