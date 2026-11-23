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

async function nativeSession({ responses, projectTest = false, configured = false, verifiedReview = false,
  diagnostics, mode = 'active' }) {
  const root = await mkdtemp(join(tmpdir(), 'pi-sitter-empty-final-'));
  const agentDir = join(root, 'agent');
  if (projectTest) await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const priorMode = process.env.PI_SITTER_MODE;
  const priorStage = process.env.PI_SITTER_STAGE;
  process.env.PI_SITTER_MODE = mode;
  process.env.PI_SITTER_STAGE = 'final';
  const faux = createFauxCore({ provider: 'empty-final-fixture' });
  faux.setResponses(responses);
  const seen = { turns: [], settles: 0, requests: [], verifies: 0, diagnostics: 0 };
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
  if (diagnostics) deps.projectDiagnostic = async (...args) => {
    seen.diagnostics++;
    return typeof diagnostics === 'function' ? diagnostics(...args) : diagnostics.shift();
  };
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

test('native Pi discovers the project test command without a startup notification', async () => {
  const h = await nativeSession({ projectTest: true, responses: [fauxAssistantMessage('Ready for host verification.')] });
  try {
    assert.equal(h.seen.turns.length, 0);
    const before = entries(h.session, 'pi-sitter-readiness');
    assert.equal(before.length, 0);
    assert.equal(entries(h.session, 'pi-sitter-startup').length, 0);
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 1);
    assert.equal(entries(h.session, 'pi-sitter-readiness').length, 0);
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
    assert.match(unavailable[0].data.unavailable, /Found npm test, but Pi Sitter did not run it as final validation/);
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

test('native Pi uses host diagnostic failure for one repair continuation and reruns it after repair', async () => {
  const h = await nativeSession({ responses: [fauxAssistantMessage('Implementation complete.'),
    fauxAssistantMessage('Repaired implementation; final report.')], diagnostics: [
    { status: 'FAIL', suite: 'fixture', passed: 0, failed: 1, total: 1,
      failures: [{ id: 'stage-one', detail: 'Expected a main scene' }] },
    { status: 'PASS', suite: 'fixture', passed: 1, failed: 0, total: 1 }] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 2);
    assert.equal(h.seen.settles, 2);
    assert.equal(h.seen.diagnostics, 2);
    assert.match(JSON.stringify(h.seen.requests[1]), /Expected a main scene/);
    assert.match(JSON.stringify(h.seen.requests[1]), /You must carry out the original task's requested source repair now/);
    assert.match(JSON.stringify(h.seen.requests[1]), /Do not end with only a diagnosis, a plan, or a promise to inspect later/);
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic-pending').length, 1);
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic').at(-1).data.followup.status, 'PASS');
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic-retry').length, 1);
    assert.equal(entries(h.session, 'pi-sitter-verification-attempt').length, 0);
    assert.equal(entries(h.session, 'pi-sitter-verification-pending').filter(row => row.data.unavailable).length, 0);
  } finally { await h.close(); }
});

test('native Pi repeated host diagnostic failure stops after one repair continuation', async () => {
  const failure = { status: 'FAIL', passed: 0, failed: 2, total: 2,
    failures: [{ id: 'downstream', detail: 'AssertionError: behavior unavailable\n    at /host/protected.test.js:8:1' },
      { id: 'saved-state', detail: 'AssertionError: Main script=missing: expected FAIL to be PASS\n    at /host/protected.test.js:9:1' }] };
  const h = await nativeSession({ responses: [fauxAssistantMessage('Done.'), fauxAssistantMessage('Done again.')],
    diagnostics: [failure, failure] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(h.seen.turns.length, 2);
    assert.equal(h.seen.diagnostics, 2);
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic-retry').length, 1);
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic').at(-1).data.status, 'FAIL');
    const retry = JSON.stringify(h.seen.requests[1]);
    assert.ok(retry.indexOf('saved-state: \\"Main script=missing') < retry.indexOf('downstream: \\"behavior unavailable'));
    assert.doesNotMatch(retry, /protected\.test\.js|at \/host/);
    assert.match(retry, /Do not repeat an unchanged inspection/);
    assert.match(retry, /repair that artifact in place, save it, and read it back/);
  } finally { await h.close(); }
});

test('Stage 04 50/51 diagnostic becomes one verified host outcome card without rewriting its evidence', async () => {
  const detail = 'AssertionError: Meteor root verification failed\n> expected saved root Node2D\n```gdscript\n> literal code\n```\n' +
    Array.from({ length: 45 }, (_, i) => `trace ${i}`).join('\n');
  const failure = { status: 'FAIL', suite: 'meteor-dodge-v1', passed: 50, failed: 1, total: 51,
    failures: [{ id: 'MD-METEOR-ROOT', detail, path: 'scenes/meteor.tscn',
      expected: 'Node2D', observed: 'Area2D' }] };
  const h = await nativeSession({ responses: [fauxAssistantMessage('First report.'), fauxAssistantMessage('Repair report.')],
    diagnostics: [failure, { status: 'PASS', suite: 'meteor-dodge-v1', passed: 51, failed: 0, total: 51 }] });
  try {
    await h.session._startRun({ messageType: 'user', prompt: 'Finish Stage 04' });
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic-pending').length, 1);
    const saved = entries(h.session, 'pi-sitter-project-diagnostic').at(-1).data;
    assert.equal(saved.followup.status, 'PASS');
    assert.equal(saved.rawResult.failures[0].detail, detail);
    assert.equal(saved.guidanceReceived, true);
    const pending = entries(h.session, 'pi-sitter-project-diagnostic-pending')[0];
    const renderer = h.session.extensionRunner.getEntryRenderer('pi-sitter-project-diagnostic-pending');
    const theme = { appearance: 'dark', style: text => text };
    const card = renderer(pending, { expanded: false }, theme);
    const summary = card.render(52).join('\n');
    assert.match(summary, /RESOLVED BY HOST DIAGNOSTIC/);
    assert.match(summary, /51\/51 passed/);
    assert.match(summary, /MD-METEOR-ROOT/);
    assert.match(summary, /Expected: Node2D/);
    assert.match(summary, /Observed: Area2D/);
    assert.ok(card.render(52).every(line => Array.from(line).length === 52));
    card.handleMouse({ type: 'click', button: 'left' });
    assert.match(card.render(80).join('\n'), /│ expected saved root Node2D/);
    card.handleMouse({ type: 'click', button: 'left' });
    assert.match(card.render(80).join('\n'), /> expected saved root Node2D/);
    assert.deepEqual(card.handleMouse({ type: 'wheel', button: 'none', wheelDelta: 32 }), { handled: true });
    assert.match(card.render(80).join('\n'), /trace 30/);
  } finally { await h.close(); }
});

test('host diagnostic shows pending immediately and discloses the exact repair prompt on both result cards', async () => {
  const gates = [];
  const deferred = () => new Promise(resolve => { gates.push(resolve); });
  const failure = { status: 'FAIL', suite: 'fixture', passed: 0, failed: 1, total: 1,
    failures: [{ id: 'spawn-interval', detail: 'Spawn interval unavailable' }] };
  const h = await nativeSession({ responses: [fauxAssistantMessage('First report.'), fauxAssistantMessage('Repair report.')],
    diagnostics: deferred });
  let run;
  try {
    run = h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    for (let i = 0; i < 100 && h.seen.diagnostics < 1; i++) await new Promise(setImmediate);
    assert.equal(h.seen.diagnostics, 1);
    const pending = entries(h.session, 'pi-sitter-project-diagnostic-pending');
    assert.equal(pending.length, 1);
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic').length, 0);
    const renderer = h.session.extensionRunner.getEntryRenderer('pi-sitter-project-diagnostic-pending');
    const styles = [];
    const theme = { appearance: 'dark', style(text, options) { styles.push(options); return text; } };
    const first = renderer(pending[0], { expanded: false }, theme);
    assert.match(first.render(100).join('\n'), /ANALYZING/);
    assert.ok(styles.every(style => style.bg.r === 55 && style.bg.g === 55 && style.bg.b === 55));
    gates[0](failure);
    for (let i = 0; i < 100 && h.seen.diagnostics < 2; i++) await new Promise(setImmediate);
    assert.equal(h.seen.diagnostics, 2);
    const firstResult = entries(h.session, 'pi-sitter-project-diagnostic')[0].data;
    const sent = h.session.sessionManager.getBranch().find(entry => entry.type === 'custom_message' &&
      entry.customType === 'pi-sitter-project-diagnostic-retry').content;
    assert.equal(firstResult.workerPrompt, sent);
    assert.ok(JSON.stringify(h.seen.requests[1]).includes(JSON.stringify(sent).slice(1, -1)));
    assert.match(sent.split('\n')[0], /1\/1 checks failed/);
    assert.match(sent.split('\n')[1], /Start with reported observation.*save it, and read it back/);
    assert.match(first.render(100).join('\n'), /click to expand/);
    assert.deepEqual(first.handleMouse({ type: 'click', button: 'left' }), { handled: true });
    assert.match(first.render(100).join('\n'), /Full prompt supplied to Worker after this diagnostic/);
    assert.match(first.render(100).join('\n'), /You must carry out the original task's requested source repair now/);
    assert.equal(entries(h.session, 'pi-sitter-project-diagnostic-pending').length, 1);
    assert.match(first.render(100).join('\n'), /CHECKING REPAIR/);
    gates[1](failure);
    await run;
    const secondResult = entries(h.session, 'pi-sitter-project-diagnostic').at(-1).data;
    assert.equal(secondResult.workerPrompt, sent);
    assert.equal(secondResult.followup.status, 'FAIL');
    const finalCard = renderer(pending[0], { expanded: false }, theme);
    assert.match(finalCard.render(100).join('\n'), /STILL FAILING/);
    finalCard.handleMouse({ type: 'click', button: 'left' });
    assert.match(finalCard.render(100).join('\n'), /Full prompt supplied to Worker after this diagnostic/);
    assert.match(finalCard.render(100).join('\n'), /You must carry out the original task's requested source repair now/);
    await h.session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
    const replayed = renderer(pending[0], { expanded: true }, theme).render(100).join('\n');
    assert.match(replayed, /Full prompt supplied to Worker after this diagnostic/);
    assert.match(replayed, /You must carry out the original task's requested source repair now/);
  } finally {
    for (const resolve of gates) resolve(failure);
    if (run) await run;
    await h.close();
  }
});

test('native Pi skips host diagnostic on abort or provider error and when protected verification is configured', async () => {
  for (const response of [fauxAssistantMessage([], { stopReason: 'aborted' }),
    fauxAssistantMessage([], { stopReason: 'error', errorMessage: 'Provider failed' })]) {
    const h = await nativeSession({ responses: [response], diagnostics: [{ status: 'PASS', passed: 1, failed: 0, total: 1 }] });
    try {
      await h.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
      assert.equal(h.seen.diagnostics, 0);
    } finally { await h.close(); }
  }
  const configured = await nativeSession({ configured: true, verifiedReview: true,
    responses: [fauxAssistantMessage('Done.')], diagnostics: [{ status: 'PASS', passed: 1, failed: 0, total: 1 }] });
  try {
    await configured.session._startRun({ messageType: 'user', prompt: 'Finish the task' });
    assert.equal(configured.seen.diagnostics, 0);
    assert.equal(configured.seen.verifies, 1);
    assert.equal(entries(configured.session, 'pi-sitter-completion').at(-1).data.decision, 'VERIFIED');
  } finally { await configured.close(); }
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
