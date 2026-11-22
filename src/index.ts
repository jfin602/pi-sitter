import type { ExtensionAPI, ExtensionContext, Theme, ToolExecutionEndEvent } from '@earendil-works/pi-coding-agent';
import { randomUUID } from 'node:crypto';
import { PiSitterEngine, classifyObservation, operationSignature, type Trigger, type PiSitterMode, type Validator } from './core.ts';
import { piSitterLimits, type PiSitterLimits } from './config.ts';
import { parseDiagnosis, runInference, type Diagnosis, type InferenceOutcome, type LoadedCheck } from './inference.ts';
import { genericFallback, type FallbackProvider } from './fallback.ts';
import { PiSitterView } from './view.ts';
import { normalizeGateReport, type GateReport, type GateSet } from './gates.ts';
import { adaptVitestReport } from './vitest-report.ts';
import { validateControllerContext, type ControllerContext } from './controller-context.ts';
import { applyRecoveryAnalysis, createRecoveryPlan, decideCompletion, noProgressRecoveryPrompt, type CompletionRecord, type RecoveryPlan } from './completion.ts';
import { EvidenceBroker } from './broker.ts';
import { openSupervisorSession } from './supervisor-session.ts';
import type { McpReadHost } from './mcp-read.ts';
import { modelAnalysisAsk, runInspectionAnalysis, type AnalysisOutcome } from './analysis.ts';
import { buildPrompt, type PromptBuilder } from './prompt.ts';
import { configuredVerifier } from './verifier.ts';
import type { ApprovedVerifier } from './verifier.ts';
import { checkpointContext, selectCheckpoint, type CheckpointRequest } from './checkpoints.ts';

const STATUS_KEY = 'pi-sitter-status';
const WIDGET_KEY = 'pi-sitter-panel';
const EVENT_TYPE = 'pi-sitter-event';
const MODE_TYPE = 'pi-sitter-mode';
const CALL_TYPE = 'pi-sitter-call';
const OUTCOME_TYPE = 'pi-sitter-outcome';
const ADVISORY_TYPE = 'pi-sitter-advisory';
const VERIFICATION_TYPE = 'pi-sitter-verification';
const VERIFICATION_PENDING_TYPE = 'pi-sitter-verification-pending';
const VERIFY_ATTEMPT_TYPE = 'pi-sitter-verification-attempt';
const CHECKPOINT_TYPE = 'pi-sitter-checkpoint';
const COMPLETION_TYPE = 'pi-sitter-completion';
const RECOVERY_TYPE = 'pi-sitter-recovery';
const RECOVERY_REQUEST_TYPE = 'pi-sitter-recovery-request';
const RECOVERY_MESSAGE_TYPE = 'pi-sitter-recovery-message';
const EVIDENCE_REQUEST_TYPE = 'pi-sitter-evidence-request';
const ANALYSIS_TYPE = 'pi-sitter-analysis';
const DELIVERY_CONFIRM_TYPE = 'pi-sitter-delivery-confirmed';
const DELIVERY_FAILURE_TYPE = 'pi-sitter-delivery-unconfirmed';
const WORKER_RECOVERY_TYPE = 'pi-sitter-worker-recovery';
const TASK_HISTORY_TYPE = 'pi-sitter-task-history';
const CONTROLLER_TYPE = 'pi-sitter-controller-inventory';
const MAX_NO_PROGRESS_RETRIES = 1;
type RecoveryEntry = { attempt: number; plan: RecoveryPlan; delivery: string; retry?: number; displayId?: string };
type RecoveryRequest = { id: string; stage: string; reset: boolean; unavailable?: string };

const SUPERVISOR_BG = { kind: 'rgb' as const, r: 64, g: 51, b: 79 };
const RECOVERY_BG = { kind: 'rgb' as const, r: 107, g: 63, b: 29 };
const FAILURE_BG = { kind: 'rgb' as const, r: 106, g: 31, b: 31 };
const PENDING_BG = { kind: 'rgb' as const, r: 55, g: 55, b: 55 };
const PENDING_LIGHT_BG = { kind: 'rgb' as const, r: 226, g: 226, b: 226 };
const SUPERVISOR_ACCENT = { kind: 'rgb' as const, r: 200, g: 185, b: 217 };
const SUPERVISOR_FG = { kind: 'rgb' as const, r: 238, g: 231, b: 245 };
const PENDING_FG = { kind: 'rgb' as const, r: 185, g: 185, b: 185 };
const PENDING_LIGHT_FG = { kind: 'rgb' as const, r: 95, g: 95, b: 95 };

type CardTone = 'normal' | 'recovery' | 'failure' | 'pending';
interface SupervisorCard {
  stage?: string;
  status: string;
  summary: string;
  details?: string[];
  tone?: CardTone;
}

function supervisorCard(theme: Theme, card: SupervisorCard, width: number): string[] {
  if (width <= 0) return [];
  const dark = theme.appearance === 'dark';
  const tone = card.tone ?? 'normal';
  const bg = dark ? (tone === 'recovery' ? RECOVERY_BG : tone === 'failure' ? FAILURE_BG : tone === 'pending' ? PENDING_BG : SUPERVISOR_BG) : tone === 'pending' ? PENDING_LIGHT_BG : 'customMessageBg';
  const fg = dark ? (tone === 'pending' ? PENDING_FG : SUPERVISOR_FG) : tone === 'pending' ? PENDING_LIGHT_FG : 'text';
  const titleFg = dark ? (tone === 'normal' ? SUPERVISOR_ACCENT : tone === 'pending' ? PENDING_FG : SUPERVISOR_FG) : tone === 'pending' ? PENDING_LIGHT_FG : 'accent';
  const statusFg = dark ? (tone === 'normal' ? SUPERVISOR_ACCENT : tone === 'pending' ? PENDING_FG : SUPERVISOR_FG) :
    tone === 'recovery' ? 'warning' : tone === 'failure' ? 'error' : tone === 'pending' ? PENDING_LIGHT_FG : 'accent';
  const spacer = theme.style(' '.repeat(width), { bg });
  const rows: { text: string; kind?: 'title' | 'status' }[] = [
    { text: ' Pi Sitter', kind: 'title' },
    { text: ` Stage ${card.stage ?? 'not recorded'}` },
    { text: ` ${card.status}`, kind: 'status' },
    { text: '' },
    { text: ` ${card.summary}` },
    ...(card.details?.length ? [{ text: '' }, ...card.details.map(text => ({ text: ` ${text}` }))] : []),
  ];
  const wrapped = rows.flatMap(row => row.text.split('\n').flatMap(text => {
    const chars = Array.from(text);
    const parts: typeof rows = [];
    for (let offset = 0; offset < chars.length; offset += width) {
      parts.push({ text: chars.slice(offset, offset + width).join(''), kind: row.kind });
    }
    return parts.length ? parts : [{ text: '', kind: row.kind }];
  }));
  return [spacer, ...wrapped.map(row => {
    const padding = ' '.repeat(width - Array.from(row.text).length);
    return theme.style(row.text + padding, {
      fg: row.kind === 'title' ? titleFg : row.kind === 'status' ? statusFg : fg,
      bg, bold: row.kind === 'title' || row.kind === 'status',
    });
  }), spacer];
}

interface OutcomeEntry {
  kind: InferenceOutcome['kind'] | 'delivered' | 'duplicate' | 'delivery_failed';
  source?: 'model' | 'fallback';
  trigger: string;
  issue?: string;
  evidence?: string;
  nextAction?: string;
  confidence?: number;
  reason?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  validation?: InferenceOutcome['validation'];
}

type Diagnoser = typeof runInference;
export interface PiSitterDependencies {
  diagnose?: Diagnoser;
  loadedCheck?: LoadedCheck;
  limits?: PiSitterLimits;
  verify?: (stage: string, projectRoot: string, options: { signal?: AbortSignal; previous?: GateReport;
    ctx?: ExtensionContext; checkpoint?: import('./checkpoints.ts').CheckpointSelection }) => Promise<unknown>;
  loadGates?: (stage: string) => Promise<GateSet>;
  /** Called only by the embedding host. Never source this from worker text, tools, or loadGates. */
  loadControllerContext?: (stage: string, projectRoot: string) => ControllerContext | undefined;
  /** Host-owned execution registry; the environment setting supplies only its identifier. */
  resolveApprovedVerifier?: (id: string, checkpoint?: import('./checkpoints.ts').CheckpointSelection) => ApprovedVerifier | undefined;
  /** Host-owned milestone signal. A missing signal uses final/post-repair settlement cadence. */
  loadCheckpoint?: (stage: string, projectRoot: string) => CheckpointRequest | undefined;
  recoveryPlan?: typeof createRecoveryPlan;
  evidenceBroker?: (projectRoot: string) => EvidenceBroker;
  /** Trusted embedding-host review and dispatcher. Omitted operations remain unavailable. */
  mcpReadHost?: (taskId: string, sourceIdentity: string) => Pick<McpReadHost, 'operations' | 'record' | 'getWorkerServerIdentity'> | undefined;
  shouldAnalyze?: (report: GateReport) => boolean;
  analyze?: typeof runInspectionAnalysis;
  milestoneValidators?: Record<string, Validator>;
  milestoneReady?: (completedToolNames: readonly string[]) => boolean;
  completionReady?: (completedToolNames: readonly string[], activeToolNames: readonly string[]) => string | undefined;
  promptBuilder?: PromptBuilder;
  fallback?: FallbackProvider;
}

function initialMode(): PiSitterMode {
  return process.env.PI_SITTER_MODE === 'active' ? 'active'
    : process.env.PI_SITTER_MODE === 'shadow' ? 'shadow' : 'off';
}

function advisoryText(trigger: Trigger, outcome: InferenceOutcome): string {
  const diagnosis = outcome.diagnosis!;
  return `[Pi Sitter guidance — extension generated, not a user request; verify before acting]\nIssue: ${diagnosis.issue}\nEvidence: ${diagnosis.evidence}\nSuggested next action: ${diagnosis.next_action}\nConfidence: ${diagnosis.confidence.toFixed(2)}\nTrigger: ${trigger.type}`;
}

export function createPiSitter(dependencies: PiSitterDependencies = {}): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI): void => {
    const limits = dependencies.limits ?? piSitterLimits();
    const engine = new PiSitterEngine(initialMode(), { maxTriggers: limits.maxTriggers,
      noChangeThreshold: limits.maxRepeatedIneffectiveOps });
    const view = new PiSitterView();
    const pendingArgs = new Map<string, { preview: string; signature: string }>();
    const terminating = new Set<string>();
    const adviceKeys = new Set<string>();
    const workerToolNames: string[] = [];
    let pending: Trigger | undefined;
    let controller: AbortController | undefined;
    let verificationController: AbortController | undefined;
    let analysisController: AbortController | undefined;
    let lastReport: GateReport | undefined;
    let controllerContext: ControllerContext | undefined;
    let lastCompletion: CompletionRecord | undefined;
    const verificationCards = new Map<string, CompletionRecord | 'interrupted' | undefined>();
    let pendingVerificationId: string | undefined;
    const recoveryCards = new Map<string, RecoveryEntry | 'interrupted' | undefined>();
    let recoveryPlan: RecoveryPlan | undefined;
    let recoveryAttempts = 0;
    let verificationRuns = 0;
    const completedCheckpoints = new Set<string>();
    const recoveryKeys = new Set<string>();
    let lastRecovery: RecoveryEntry | undefined;
    let recoveryTurnObserved = false;
    let workerState: 'Running' | 'Verifying' | 'Recovering' = 'Running';
    let verificationActivity = 'Waiting for completion';
    let verificationStartedAt = 0;
    let verificationElapsedMs = 0;
    let supervisorActivity = 'Idle';
    let completionDiagnosisCalls = 0;
    let recoveryGenerationCalls = 0;
    let uiTimer: ReturnType<typeof setTimeout> | undefined;
    let lastStatus: string | undefined = '';
    let lastWidget = '';
    let lastRenderAt = 0;
    let calls = 0;
    let delivered = 0;
    let validDiagnoses = 0;
    let modelAdvisories = 0;
    let fallbackAdvisories = 0;
    let failedDeliveries = 0;
    let workerRecoveries = 0;
    let confirmedDeliveries = 0;
    const awaitingContext = new Set<string>();
    let lastAdviceEpoch: number | undefined;
    let lastAdviceTool: string | undefined;
    let lastAdviceOperation: string | undefined;
    let repeatedAfterAdvice = 0;
    let lastRejectedReason = '';
    let abstained = 0;
    let failed = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalLatencyMs = 0;

    function remaining(): number { return Math.max(0, limits.maxInferenceAttempts - calls); }
    function interventionRemaining(): number { return Math.max(0,
      limits.maxValidAdvisories - modelAdvisories + limits.maxFallbackAdvisories - fallbackAdvisories); }

    // A new user turn starts a new bounded completion cycle. Automatic recovery
    // messages are custom turns and retain the current cycle's limits.
    function startUserCompletionCycle(): void {
      recoveryAttempts = 0;
      verificationRuns = 0;
      recoveryKeys.clear();
      lastRecovery = undefined;
      recoveryTurnObserved = false;
    }

    function beginPendingVerification(ctx: ExtensionContext): void {
      if (!ctx.hasUI || pendingVerificationId || verificationRuns >= limits.maxCompletionVerifications) return;
      const id = randomUUID();
      verificationCards.set(id, undefined);
      try { pi.appendEntry(VERIFICATION_PENDING_TYPE, { id, stage: engine.stage }); }
      catch { verificationCards.delete(id); return; }
      pendingVerificationId = id;
      ctx.ui.setWorkingMessage('Pi Sitter verifying…');
      ctx.ui.setWorkingVisible(true);
    }

    function showUnavailableVerification(reason: string): void {
      pi.appendEntry(VERIFICATION_PENDING_TYPE, { id: randomUUID(), stage: engine.stage, unavailable: reason });
    }

    function appendCompletion(ctx: ExtensionContext, completion: CompletionRecord): void {
      if (pendingVerificationId) {
        completion.displayId = pendingVerificationId;
        verificationCards.set(pendingVerificationId, completion);
        pendingVerificationId = undefined;
        if (ctx.hasUI) ctx.ui.setWorkingMessage();
      }
      pi.appendEntry(COMPLETION_TYPE, completion);
    }

    function noProgressRetryReady(report: GateReport | undefined): boolean {
      return !!report && lastCompletion?.decision === 'RECOVERY_REQUIRED' && !!recoveryPlan &&
        engine.mode === 'active' && !!lastRecovery && recoveryTurnObserved &&
        lastRecovery.plan.stage === report.stage && lastRecovery.plan.snapshotIdentity === report.snapshotIdentity &&
        (lastRecovery.retry ?? 0) < MAX_NO_PROGRESS_RETRIES &&
        verificationRuns < limits.maxCompletionVerifications;
    }

    function beginNoProgressRetry(ctx: ExtensionContext): RecoveryEntry {
      const retry: RecoveryEntry = { attempt: lastRecovery!.attempt, plan: recoveryPlan!,
        delivery: 'committed_for_continuation', retry: (lastRecovery!.retry ?? 0) + 1 };
      lastRecovery = retry;
      recoveryTurnObserved = false;
      workerState = 'Recovering';
      verificationActivity = `No saved progress; retrying recovery ${retry.attempt}`;
      render(ctx);
      return retry;
    }

    function render(ctx: ExtensionContext): void {
      if (!ctx.hasUI) return;
      const status = engine.mode !== 'off' ? ctx.ui.theme.fg('muted', view.status(engine.mode, engine.triggerCount)) : undefined;
      if (status !== lastStatus) {
        ctx.ui.setStatus(STATUS_KEY, status);
        lastStatus = status;
      }
      const lines = engine.mode === 'off' ? undefined : view.lines({ mode: engine.mode,
        remaining: remaining(), calls, delivered, failed, abstained, latencyMs: totalLatencyMs });
      if (lines) {
        lines.splice(1, 0, `Worker ${workerState} | stage ${engine.stage || 'unset'} | gates ${lastCompletion?.decision ?? 'pending'}`);
        lines.splice(2, 0, `${verificationActivity} | ${verificationElapsedMs} ms | recovery ${recoveryAttempts}/${limits.maxRecoveryAttempts}`);
        const unresolved = lastCompletion?.failedGateIds.length ? lastCompletion.failedGateIds : lastCompletion?.unverifiedGateIds;
        if (unresolved?.length) lines.splice(3, 0, `Unresolved: ${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? '…' : ''}`);
        lines.splice(4, 0, `Supervisor inference: ${supervisorActivity}`);
        lines.splice(5, 0, `Triggers ${engine.triggerCount} | inference ${calls}/${limits.maxInferenceAttempts} | valid ${validDiagnoses} | fallback ${fallbackAdvisories}/${limits.maxFallbackAdvisories} | delivered ${delivered}`);
        lines.splice(6, 0, `Failed delivery ${failedDeliveries} | Worker recoveries ${workerRecoveries} | interventions remaining ${interventionRemaining()}`);
        if (lastRejectedReason) lines.splice(7, 0, `Last rejected diagnosis: ${lastRejectedReason}`);
      }
      const widget = lines?.join('\n') ?? '';
      if (widget !== lastWidget) {
        ctx.ui.setWidget(WIDGET_KEY, lines, { placement: 'aboveEditor' });
        lastWidget = widget;
      }
    }

    function scheduleRender(ctx: ExtensionContext): void {
      if (!ctx.hasUI) return;
      const now = performance.now();
      if (now - lastRenderAt >= limits.debounceMs) {
        lastRenderAt = now;
        render(ctx);
      } else if (!uiTimer) {
        uiTimer = setTimeout(() => {
          uiTimer = undefined;
          try { lastRenderAt = performance.now(); render(ctx); } catch { /* UI is best effort. */ }
        }, limits.debounceMs - (now - lastRenderAt));
      }
    }

    function stopUI(): void {
      if (uiTimer) clearTimeout(uiTimer);
      uiTimer = undefined;
    }

    function recordTrigger(trigger: Trigger, ctx: ExtensionContext): void {
      view.trigger(trigger);
      if (!pending && !controller && interventionRemaining() > 0) pending = trigger;
      else if (interventionRemaining() === 0) view.finish('error', 'Intervention budget exhausted');
      pi.appendEntry(EVENT_TYPE, trigger);
      render(ctx);
    }

    function recordOutcome(trigger: Trigger, outcome: InferenceOutcome, kind: OutcomeEntry['kind'] = outcome.kind,
      source?: OutcomeEntry['source']): void {
      const diagnosis = outcome.diagnosis;
      pi.appendEntry<OutcomeEntry>(OUTCOME_TYPE, {
        kind, source, trigger: trigger.key, issue: diagnosis?.issue, evidence: diagnosis?.evidence,
        nextAction: diagnosis?.next_action, confidence: diagnosis?.confidence,
        reason: outcome.reason, latencyMs: outcome.latencyMs,
        inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens,
        validation: outcome.validation,
      });
    }

    function fallbackFor(trigger: Trigger): Diagnosis | undefined {
      for (const provide of [genericFallback, dependencies.fallback]) {
        if (!provide) continue;
        const candidate = provide(trigger, engine.recent);
        if (candidate && parseDiagnosis(JSON.stringify(candidate), trigger).kind === 'ready') return candidate;
      }
    }

    async function verify(ctx: ExtensionContext, request: CheckpointRequest = { reason: 'manual', milestoneId: 'manual' }): Promise<{ report?: GateReport; completion?: CompletionRecord }> {
      if (verificationController) { ctx.ui.notify('Pi Sitter verification is already running', 'warning'); return {}; }
      if (!engine.stage) { ctx.ui.notify('Set a task stage before verification', 'warning'); return {}; }
      if (request.reason === 'milestone') {
        try {
          const raw = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
          if (raw) {
            const authoritative = validateControllerContext(raw, engine.stage);
            const selected = selectCheckpoint(authoritative, request, lastReport);
            const key = [selected.taskId, selected.milestoneId, selected.snapshotId,
              authoritative.suite.digest, selected.reason].join(':');
            if (completedCheckpoints.has(key)) return {};
          }
        } catch { /* The normal verification path records BLOCKED. */ }
      }
      if (verificationRuns >= limits.maxCompletionVerifications) {
        verificationActivity = 'Completion verification budget exhausted';
        ctx.ui.notify('Pi Sitter completion verification budget exhausted', 'warning');
        render(ctx);
        return {};
      }
      verificationRuns++;
      try { pi.appendEntry(VERIFY_ATTEMPT_TYPE, { stage: engine.stage, attempt: verificationRuns }); }
      catch { /* Verification still runs if metadata could not be saved. */ }
      const current = new AbortController();
      verificationController = current;
      const sessionId = engine.sessionId;
      const task = engine.task;
      workerState = 'Verifying';
      verificationActivity = 'Inspecting saved project snapshot';
      verificationStartedAt = performance.now();
      render(ctx);
      try {
        const suppliedAtStart = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
        if (!suppliedAtStart) throw new Error('Trusted controller task and protected suite are not configured');
        const authoritative = validateControllerContext(suppliedAtStart, engine.stage);
        const checkpoint = selectCheckpoint(authoritative, request, lastReport);
        const checkpointKey = [checkpoint.taskId, checkpoint.milestoneId, checkpoint.snapshotId,
          authoritative.suite.digest, checkpoint.reason].join(':');
        if (request.reason === 'milestone' && completedCheckpoints.has(checkpointKey)) return {};
        if (request.reason === 'milestone') completedCheckpoints.add(checkpointKey);
        pi.appendEntry(CHECKPOINT_TYPE, checkpoint);
        if (!controllerContext || JSON.stringify(controllerContext) !== JSON.stringify(authoritative)) {
          lastReport = undefined;
          lastCompletion = undefined;
          recoveryPlan = undefined;
        }
        controllerContext = authoritative;
        engine.setTask(authoritative.originalTask.text, authoritative.stage);
        const run = dependencies.verify ?? configuredVerifier(undefined, dependencies.resolveApprovedVerifier);
        if (!run) throw new Error('No verification provider is configured for this project');
        const raw = await run(engine.stage, ctx.cwd, { signal: current.signal, previous: lastReport, ctx,
          checkpoint });
        if (current.signal.aborted || engine.sessionId !== sessionId) return {};
        const suppliedAtEnd = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
        if (!suppliedAtEnd) throw new Error('Trusted controller task and protected suite are not configured');
        const currentContext = validateControllerContext(suppliedAtEnd, engine.stage);
        if (currentContext.taskId !== authoritative.taskId ||
            JSON.stringify(currentContext.originalTask) !== JSON.stringify(authoritative.originalTask) ||
            JSON.stringify(currentContext.suite) !== JSON.stringify(authoritative.suite))
          throw new Error('Trusted controller task or suite changed during verification');
        controllerContext = currentContext;
        const selectedContext = checkpointContext(currentContext, checkpoint);
        const input = raw && typeof raw === 'object' && !Array.isArray(raw) && 'format' in raw && raw.format === 'vitest-json'
          ? adaptVitestReport(raw, selectedContext) : raw;
        const report = normalizeGateReport(input, selectedContext, lastReport);
        report.checkpoint = { ...checkpoint, runId: report.runId };
        pi.appendEntry(VERIFICATION_TYPE, report);
        lastReport = report;
        const decision = decideCompletion(report);
        verificationElapsedMs = Math.round(performance.now() - verificationStartedAt);
        const completion: CompletionRecord = { stage: report.stage, task: authoritative.originalTask.text, runId: report.runId,
          decision: decision.decision,
          snapshotIdentity: report.snapshotIdentity, counts: report.counts,
          failedGateIds: report.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
          unverifiedGateIds: report.gates.filter(gate => gate.result === 'UNVERIFIED').map(gate => gate.id),
          regressions: report.regressions, attempt: recoveryAttempts, elapsedMs: verificationElapsedMs,
          reason: decision.reason };
        appendCompletion(ctx, completion);
        lastCompletion = completion;
        recoveryPlan = completion.decision === 'RECOVERY_REQUIRED' ? (dependencies.recoveryPlan ?? createRecoveryPlan)(report, authoritative.originalTask.text) : undefined;
        verificationActivity = 'Verification complete';
        return { report, completion };
      } catch (error) {
        if (!current.signal.aborted) {
          lastReport = undefined;
          recoveryPlan = undefined;
          const reason = error instanceof Error ? error.message.slice(0, 300) : 'unknown error';
          verificationElapsedMs = Math.round(performance.now() - verificationStartedAt);
          const completion: CompletionRecord = { stage: engine.stage, task, decision: 'BLOCKED', snapshotIdentity: 'unavailable',
            counts: { PASS: 0, FAIL: 0, UNVERIFIED: 0 }, failedGateIds: [], unverifiedGateIds: [], regressions: [],
            attempt: recoveryAttempts, elapsedMs: verificationElapsedMs, reason };
          appendCompletion(ctx, completion);
          lastCompletion = completion;
          verificationActivity = 'Verification blocked';
          ctx.ui.notify(`Pi Sitter verification blocked: ${reason.slice(0, 140)}`, 'error');
          return { completion };
        }
        return {};
      } finally {
        if (verificationController === current) verificationController = undefined;
        if (workerState === 'Verifying') workerState = 'Running';
        render(ctx);
      }
    }

    async function diagnose(trigger: Trigger, ctx: ExtensionContext): Promise<{ outcome: InferenceOutcome; modeAtStart: PiSitterMode; stale: boolean }> {
      const modeAtStart = engine.mode;
      const sessionAtStart = engine.sessionId;
      if (modeAtStart === 'off' || remaining() === 0 || controller) return { outcome: { kind: 'canceled', latencyMs: 0, reason: 'supervision disabled, busy, or budget exhausted' }, modeAtStart, stale: false };
      controller = new AbortController();
      const current = controller;
      const input = { task: engine.task, stage: engine.stage, trigger, recent: engine.recent,
        workerTools: pi.getActiveTools() };
      let outcome: InferenceOutcome = { kind: 'failed', latencyMs: 0, reason: 'No inference attempted' };
      try {
        const infer = dependencies.diagnose ?? runInference;
        for (let attempt = 0; attempt < 2 && remaining() > 0 && !current.signal.aborted; attempt++) {
          calls++;
          pi.appendEntry(CALL_TYPE, { trigger: trigger.key, stage: engine.stage, attempt: calls,
            formattingRetry: attempt === 1 });
          supervisorActivity = attempt === 1 ? 'Correcting invalid diagnosis format' : 'Generating diagnosis';
          view.stream(supervisorActivity);
          render(ctx);
          const retryBuilder: PromptBuilder | undefined = attempt === 1 ? (retryInput, maxChars) => {
            const base = (dependencies.promptBuilder ?? buildPrompt)(retryInput, maxChars);
            const rule = `\nPrevious response failed validation (${outcome.reason?.slice(0, 100) ?? 'invalid output'}). Return only valid JSON with issue <=180, evidence <=220, next_action <=220 characters. Copy evidence exactly from the trigger. Give one short action.`;
            return { systemPrompt: base.systemPrompt + rule,
              userText: base.userText.slice(0, Math.max(0, maxChars - base.systemPrompt.length - rule.length)) };
          } : dependencies.promptBuilder;
          outcome = await infer(ctx, input, limits, current.signal, () => {
            if (current.signal.aborted || engine.mode === 'off') return;
            view.stream(supervisorActivity);
            scheduleRender(ctx);
          }, dependencies.loadedCheck, retryBuilder);
          totalLatencyMs += outcome.latencyMs;
          inputTokens += outcome.inputTokens ?? 0;
          outputTokens += outcome.outputTokens ?? 0;
          if (outcome.kind === 'ready') validDiagnoses++;
          if (outcome.kind === 'abstained') abstained++;
          if (outcome.kind === 'failed' || outcome.kind === 'timeout') failed++;
          if (outcome.invalidOutput && attempt === 0 && remaining() > 0) {
            lastRejectedReason = outcome.reason?.slice(0, 140) ?? 'invalid output';
            recordOutcome(trigger, outcome);
            view.finish('error', `Diagnosis rejected: ${outcome.reason ?? 'invalid output'}; retrying format`);
            render(ctx);
            continue;
          }
          if (outcome.invalidOutput) lastRejectedReason = outcome.reason?.slice(0, 140) ?? 'invalid output';
          break;
        }
      } catch (error) {
        outcome = { kind: current.signal.aborted ? 'canceled' : 'failed', latencyMs: 0,
          reason: error instanceof Error ? error.message.slice(0, 160) : 'Pi Sitter error' };
      } finally {
        if (controller === current) {
          controller = undefined;
          stopUI();
        }
      }
      const stale = engine.sessionId !== sessionAtStart;
      if (current.signal.aborted || stale) {
        outcome = { kind: 'canceled', latencyMs: outcome.latencyMs, reason: 'Pi Sitter disabled or session changed' };
      }
      if (stale) return { outcome, modeAtStart, stale };
      if (engine.mode !== 'off') {
        if (outcome.kind === 'ready') view.finish('ready', `${outcome.diagnosis!.issue} — ${outcome.diagnosis!.next_action}`);
        else if (outcome.kind === 'abstained') view.finish('abstained', outcome.reason ?? 'Insufficient evidence');
        else if (outcome.kind === 'timeout') view.finish('timeout', outcome.reason ?? 'Pi Sitter timed out');
        else view.finish('error', outcome.reason ?? 'Pi Sitter unavailable');
      }
      supervisorActivity = outcome.kind === 'ready' ? 'Valid diagnosis' : `Diagnosis ${outcome.kind}: ${outcome.reason ?? 'no detail'}`;
      render(ctx);
      return { outcome, modeAtStart, stale };
    }

    pi.registerEntryRenderer<Trigger>(EVENT_TYPE, (entry, { expanded }, theme) => {
      const data = entry.data;
      if (!data) return;
      return { render(width: number) { return expanded ? supervisorCard(theme, {
        stage: data.stage, status: 'TRIGGER_DETECTED', summary: `${data.type}: ${data.tool}`,
        details: [data.evidence, 'Advisory only'],
      }, width) : []; }, invalidate() {} };
    });
    pi.registerEntryRenderer<OutcomeEntry>(OUTCOME_TYPE, (entry, { expanded }, theme) => {
      const data = entry.data;
      if (!data) return;
      return { render(width: number) { return (expanded || data.kind === 'delivered' || data.kind === 'delivery_failed' || data.kind === 'failed' || data.kind === 'timeout') ?
        supervisorCard(theme, {
          status: data.kind.toUpperCase(),
          summary: `${data.source === 'fallback' ? 'Fallback: ' : ''}${data.issue ?? data.reason ?? 'No advisory'}`,
          details: expanded && data.nextAction ? [`Evidence: ${data.evidence ?? '(none)'}`, `Next: ${data.nextAction}`] : [],
          tone: data.kind === 'delivery_failed' || data.kind === 'failed' || data.kind === 'timeout' ? 'failure' : 'normal',
        }, width) : []; }, invalidate() {} };
    });
    pi.registerMessageRenderer(ADVISORY_TYPE, (message, _options, theme) => ({
      render(width: number) {
        const lines = (typeof message.content === 'string' ? message.content : '').split('\n');
        if (lines[0]?.startsWith('[Pi Sitter guidance')) lines.shift();
        return supervisorCard(theme, { status: 'GUIDANCE', summary: lines.shift() ?? 'Supervisor guidance', details: lines }, width);
      }, invalidate() {},
    }));
    pi.registerEntryRenderer<GateReport>(VERIFICATION_TYPE, (entry, { expanded }, theme) => {
      const report = entry.data;
      if (!report) return;
      const unavailable = report.snapshotIdentity === 'unavailable' || report.gates.length === 0;
      const failed = report.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id);
      const unverified = report.gates.filter(gate => gate.result === 'UNVERIFIED').map(gate => gate.id);
      const exhausted = lastCompletion?.snapshotIdentity === report.snapshotIdentity &&
        lastCompletion.stage === report.stage && lastCompletion.attempt >= limits.maxRecoveryAttempts;
      const status = report.schemaVersion === 1 ? 'HISTORICAL' : unavailable ? 'BLOCKED' : failed.length ?
        (exhausted ? 'FAILED' : 'RECOVERY_REQUIRED') : 'UNVERIFIED';
      const summary = report.schemaVersion === 1 ? 'Legacy v1 evidence lacks controller provenance' :
        unavailable ? 'Saved snapshot could not be verified' : failed.length ?
        `${failed.length} failed: ${failed.join(', ')}` : unverified.length ?
          `${unverified.length} unverified: ${unverified.join(', ')}` : `${report.counts.PASS} gates passed`;
      return { render(width: number) { return expanded ? supervisorCard(theme, {
        stage: report.stage, status, summary,
        details: [...report.gates.filter(gate => gate.result !== 'PASS').slice(0, 20).map(gate =>
          `${gate.id}: ${gate.result}. ${gate.evidence || gate.explanation}`),
          `${report.regressions.length} regressions`, `Snapshot ${report.snapshotIdentity.slice(0, 12)}`],
        tone: unavailable || unverified.length || exhausted ? 'failure' : failed.length ? 'recovery' : 'normal',
      }, width) : []; }, invalidate() {} };
    });
    function renderCompletionCard(value: CompletionRecord, expanded: boolean, theme: Theme, width: number): string[] {
      const summary = value.decision === 'VERIFIED' ? 'Historical success claim; current requirement review unavailable' :
        value.decision === 'RECOVERY_REQUIRED' ?
          `${value.counts.FAIL} failed: ${value.failedGateIds.join(', ') || value.reason}` :
          value.decision === 'UNVERIFIED' ?
            `${value.counts.UNVERIFIED} unverified: ${value.unverifiedGateIds.join(', ') || value.reason}` : value.reason;
      const tone: CardTone = value.decision === 'VERIFIED' ? 'normal' :
        value.decision === 'RECOVERY_REQUIRED' && value.attempt < limits.maxRecoveryAttempts ? 'recovery' : 'failure';
      return supervisorCard(theme, {
        stage: value.stage,
        status: value.decision === 'VERIFIED' ? 'HISTORICAL' : value.decision === 'RECOVERY_REQUIRED' && tone === 'failure' ? 'FAILED' : value.decision,
        summary, details: expanded && value.reason !== summary ? [value.reason] : [], tone,
      }, width);
    }
    pi.registerEntryRenderer<{ id: string; stage: string; unavailable?: string }>(VERIFICATION_PENDING_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value?.id) return;
      return { render(width: number) {
        if (value.unavailable) return supervisorCard(theme, { stage: value.stage,
          status: 'UNAVAILABLE', summary: value.unavailable, tone: 'failure',
        }, width);
        const state = verificationCards.get(value.id);
        if (state && state !== 'interrupted') return renderCompletionCard(state, expanded, theme, width);
        return supervisorCard(theme, { stage: value.stage,
          status: state === 'interrupted' ? 'INTERRUPTED' : 'VERIFYING',
          summary: state === 'interrupted' ? 'Verification ended before a result was returned' : 'Checking the saved project…',
          tone: state === 'interrupted' ? 'failure' : 'pending',
        }, width);
      }, invalidate() {} };
    });
    pi.registerEntryRenderer<CompletionRecord>(COMPLETION_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value || (value.displayId && verificationCards.has(value.displayId))) return;
      return { render(width: number) { return renderCompletionCard(value, expanded, theme, width); }, invalidate() {} };
    });
    pi.registerEntryRenderer<RecoveryEntry>(RECOVERY_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value || (value.displayId && recoveryCards.has(value.displayId))) return;
      const details = value.plan.text.split('\n');
      if (details[0]?.startsWith('Pi Sitter Recovery — Stage ')) details.shift();
      return { render(width: number) { return expanded ? supervisorCard(theme, {
        stage: value.plan.stage, status: 'RECOVERY_QUEUED',
        summary: `Attempt ${value.attempt} of ${limits.maxRecoveryAttempts}${value.retry ? `, retry ${value.retry}` : ''} for ${value.plan.focusGateIds.join(', ')}`,
        details: [`Delivery: ${value.delivery}`, ...details], tone: 'recovery',
      }, width) : []; }, invalidate() {} };
    });
    pi.registerEntryRenderer<RecoveryRequest>(RECOVERY_REQUEST_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value?.id) return;
      return { render(width: number) {
        if (value.unavailable) return supervisorCard(theme, { stage: value.stage,
          status: 'UNAVAILABLE', summary: value.unavailable, tone: 'failure',
        }, width);
        const state = recoveryCards.get(value.id);
        if (!state || state === 'interrupted') return supervisorCard(theme, { stage: value.stage,
          status: state === 'interrupted' ? 'INTERRUPTED' : 'RECOVERY_REQUESTED',
          summary: state === 'interrupted' ? 'Recovery ended before a prompt was queued' : 'Preparing the Worker recovery prompt…',
          tone: state === 'interrupted' ? 'failure' : 'pending',
        }, width);
        return supervisorCard(theme, { stage: value.stage, status: 'RECOVERY_QUEUED',
          summary: `Attempt ${state.attempt} of ${limits.maxRecoveryAttempts} for ${state.plan.focusGateIds.join(', ')}`,
          details: expanded ? [`Delivery: ${state.delivery}`, ...state.plan.text.split('\n')] : [], tone: 'recovery',
        }, width);
      }, invalidate() {} };
    });
    pi.registerEntryRenderer<AnalysisOutcome>(ANALYSIS_TYPE, (entry, _options, theme) => {
      const value = entry.data;
      if (!value) return;
      return { render(width: number) { return supervisorCard(theme, {
        status: `ANALYSIS_${value.kind.toUpperCase()}`,
        summary: `${value.calls} calls in ${value.elapsedMs} ms`,
        tone: value.kind === 'failed' || value.kind === 'timeout' ? 'failure' : 'normal',
      }, width); }, invalidate() {} };
    });
    pi.registerEntryRenderer<{ snapshotIdentity: string; requests: unknown[]; results: unknown[] }>(EVIDENCE_REQUEST_TYPE, (entry, _options, theme) => {
      const value = entry.data;
      if (!value) return;
      return { render(width: number) { return supervisorCard(theme, {
        status: 'INSPECTIONS', summary: `${value.requests.length} requests`,
        details: [`Snapshot ${value.snapshotIdentity.slice(0, 12)}`],
      }, width); }, invalidate() {} };
    });
    pi.registerMessageRenderer(RECOVERY_MESSAGE_TYPE, (message, _options, theme) => ({
      render(width: number) {
        const lines = (typeof message.content === 'string' ? message.content : '').split('\n');
        const stage = /^Pi Sitter Recovery — Stage (.+)$/.exec(lines[0] ?? '')?.[1];
        if (stage) lines.shift();
        return supervisorCard(theme, { stage, status: 'RECOVERY_GUIDANCE',
          summary: 'Repair the failed gates in the current Worker task', details: lines, tone: 'recovery' }, width);
      }, invalidate() {},
    }));

    pi.on('session_start', (_event, ctx) => {
      try {
        controller?.abort(new Error('Pi Sitter session changed'));
        verificationController?.abort(new Error('Pi Sitter session changed'));
        analysisController?.abort(new Error('Pi Sitter session changed'));
        stopUI();
        engine.reset(initialMode());
        view.reset();
        pendingArgs.clear();
        terminating.clear();
        adviceKeys.clear();
        workerToolNames.length = 0;
        pending = undefined;
        controller = undefined;
        verificationController = undefined;
        analysisController = undefined;
        lastReport = undefined;
        controllerContext = undefined;
        lastCompletion = undefined;
        verificationCards.clear();
        pendingVerificationId = undefined;
        recoveryCards.clear();
        recoveryPlan = undefined;
        recoveryAttempts = 0;
        verificationRuns = 0;
        completedCheckpoints.clear();
        recoveryKeys.clear();
        lastRecovery = undefined;
        recoveryTurnObserved = false;
        workerState = 'Running';
        verificationActivity = 'Waiting for completion';
        verificationElapsedMs = 0;
        supervisorActivity = 'Idle';
        completionDiagnosisCalls = recoveryGenerationCalls = 0;
        lastRenderAt = 0;
        calls = delivered = abstained = failed = inputTokens = outputTokens = totalLatencyMs = 0;
        validDiagnoses = modelAdvisories = fallbackAdvisories = failedDeliveries = workerRecoveries = confirmedDeliveries = 0;
        lastAdviceEpoch = undefined;
        lastAdviceTool = undefined;
        lastAdviceOperation = undefined;
        repeatedAfterAdvice = 0;
        lastRejectedReason = '';
        awaitingContext.clear();
        const stage = process.env.PI_SITTER_STAGE ?? 'current';
        let historicalTask = '';
        for (const entry of ctx.sessionManager.getBranch()) {
          if (entry.type === 'message' && entry.message.role === 'user') startUserCompletionCycle();
          if (entry.type === 'message' && lastRecovery && entry.message.role === 'assistant') recoveryTurnObserved = true;
          if (entry.type !== 'custom') continue;
          if (entry.customType === TASK_HISTORY_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as { stage?: string; task?: string };
            if (saved.stage === stage && typeof saved.task === 'string' && saved.task.length <= 65536) historicalTask = saved.task;
          }
          if (entry.customType === MODE_TYPE && (entry.data === 'off' || entry.data === 'shadow' || entry.data === 'active')) engine.setMode(entry.data);
          if (entry.customType === EVENT_TYPE && entry.data && typeof entry.data === 'object') engine.restoreTrigger(entry.data as Trigger);
          if (entry.customType === CALL_TYPE) calls++;
          if (entry.customType === DELIVERY_CONFIRM_TYPE) confirmedDeliveries++;
          if (entry.customType === DELIVERY_FAILURE_TYPE) failedDeliveries++;
          if (entry.customType === WORKER_RECOVERY_TYPE) workerRecoveries++;
          if (entry.customType === ANALYSIS_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as AnalysisOutcome;
            completionDiagnosisCalls += Math.min(1, saved.calls ?? 0);
            recoveryGenerationCalls += Math.max(0, (saved.calls ?? 0) - 1);
          }
          if (entry.customType === VERIFICATION_TYPE && entry.data && typeof entry.data === 'object' && (entry.data as GateReport).stage === stage) lastReport = entry.data as GateReport;
          if (entry.customType === VERIFICATION_PENDING_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as { id?: string; stage?: string; unavailable?: string };
            if (saved.stage === stage && saved.id && !saved.unavailable) verificationCards.set(saved.id, undefined);
          }
          if (entry.customType === RECOVERY_REQUEST_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as RecoveryRequest;
            if (saved.stage === stage && saved.id && !saved.unavailable) {
              if (saved.reset) startUserCompletionCycle();
              recoveryCards.set(saved.id, undefined);
            }
          }
          if (entry.customType === VERIFY_ATTEMPT_TYPE && entry.data && typeof entry.data === 'object' &&
              (entry.data as { stage?: string }).stage === stage) verificationRuns++;
          if (entry.customType === COMPLETION_TYPE && entry.data && typeof entry.data === 'object' && (entry.data as CompletionRecord).stage === stage) {
            lastCompletion = entry.data as CompletionRecord;
            if (lastCompletion.displayId && verificationCards.has(lastCompletion.displayId))
              verificationCards.set(lastCompletion.displayId, lastCompletion);
          }
          if (entry.customType === RECOVERY_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as RecoveryEntry;
            if (saved.plan?.stage === stage && saved.delivery !== 'blocked') {
              if (saved.displayId && recoveryCards.has(saved.displayId)) recoveryCards.set(saved.displayId, saved);
              recoveryAttempts = Math.max(recoveryAttempts, saved.attempt ?? 0);
              recoveryKeys.add(saved.plan.key);
              lastRecovery = saved;
              recoveryTurnObserved = false;
            }
          }
          if (entry.customType === OUTCOME_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as OutcomeEntry;
            if (saved.kind === 'delivered') {
              delivered++;
              if (saved.source === 'fallback') fallbackAdvisories++;
              else modelAdvisories++;
            }
            if (saved.kind === 'delivery_failed') failedDeliveries++;
            if (saved.validation && saved.reason) lastRejectedReason = saved.reason.slice(0, 140);
            if (saved.kind === 'ready' || (saved.kind === 'delivered' && saved.source !== 'fallback')) validDiagnoses++;
            if (saved.kind === 'abstained') abstained++;
            if (saved.kind === 'failed' || saved.kind === 'timeout') failed++;
            inputTokens += saved.inputTokens ?? 0;
            outputTokens += saved.outputTokens ?? 0;
            totalLatencyMs += saved.latencyMs ?? 0;
            if (saved.kind === 'delivered' && saved.issue && saved.nextAction) adviceKeys.add(`${saved.issue.toLowerCase()}|${saved.nextAction.toLowerCase()}`);
          }
        }
        for (const [id, state] of verificationCards) if (!state) verificationCards.set(id, 'interrupted');
        for (const [id, state] of recoveryCards) if (!state) recoveryCards.set(id, 'interrupted');
        const supplied = dependencies.loadControllerContext?.(stage, ctx.cwd);
        if (supplied) {
          controllerContext = validateControllerContext(supplied, stage);
          engine.setTask(controllerContext.originalTask.text, stage);
          pi.appendEntry(CONTROLLER_TYPE, { taskId: controllerContext.taskId, stage,
            reference: controllerContext.originalTask.reference, version: controllerContext.originalTask.version,
            suiteId: controllerContext.suite.id, suiteDigest: controllerContext.suite.digest,
            sourceSnapshot: controllerContext.sourceSnapshot });
        } else engine.setTask(historicalTask || (stage ? `Task stage ${stage}` : 'Pi session'), stage);
        // Session entries are historical only. A fresh host-run check is needed for current status.
        if (!controllerContext || lastReport?.schemaVersion !== 2 ||
            lastReport.taskId !== controllerContext.taskId ||
            lastReport.suite.digest !== controllerContext.suite.digest ||
            lastReport.snapshotIdentity !== controllerContext.sourceSnapshot) {
          lastReport = undefined;
          lastCompletion = undefined;
          recoveryPlan = undefined;
        } else {
          try {
            lastReport = normalizeGateReport({ schemaVersion: 2, taskId: lastReport.taskId, runId: lastReport.runId, stage: lastReport.stage,
              snapshotIdentity: lastReport.snapshotIdentity, suite: lastReport.suite,
              testCounts: lastReport.testCounts, execution: { exitCode: lastReport.testCounts.failed > 0 ? 1 : 0 },
              gates: lastReport.gates.map(gate => ({ id: gate.id, tests: gate.tests })) }, controllerContext);
            if (lastCompletion) {
              const decision = decideCompletion(lastReport);
              lastCompletion = { ...lastCompletion, decision: decision.decision, reason: decision.reason,
                counts: lastReport.counts, failedGateIds: lastReport.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
                unverifiedGateIds: lastReport.gates.filter(gate => gate.result === 'UNVERIFIED').map(gate => gate.id) };
            }
          } catch {
            lastReport = undefined;
            lastCompletion = undefined;
            recoveryPlan = undefined;
          }
        }
        for (const [id, card] of verificationCards) {
          if (card && card !== 'interrupted' && card.decision === 'VERIFIED')
            verificationCards.set(id, { ...card, decision: 'UNVERIFIED', reason: 'Historical completion requires current controller evidence' });
        }
        if (lastReport && lastCompletion?.decision === 'RECOVERY_REQUIRED') recoveryPlan = (dependencies.recoveryPlan ?? createRecoveryPlan)(lastReport, lastCompletion.task);
        engine.sessionId = ctx.sessionManager.getSessionId();
        lastStatus = lastWidget = '';
        render(ctx);
      } catch {
        controllerContext = undefined;
        lastReport = undefined;
        lastCompletion = undefined;
        recoveryPlan = undefined;
      }
    });

    pi.on('before_agent_start', (event, ctx) => {
      try {
        if (event.messageType === 'user') {
          startUserCompletionCycle();
          const supplied = ctx && dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
          if (supplied) {
            const next = validateControllerContext(supplied, engine.stage);
            if (controllerContext?.taskId !== next.taskId || controllerContext.suite.digest !== next.suite.digest ||
                controllerContext.sourceSnapshot !== next.sourceSnapshot) {
              lastReport = undefined;
              lastCompletion = undefined;
              recoveryPlan = undefined;
            }
            controllerContext = next;
            engine.setTask(next.originalTask.text, next.stage);
          } else if (dependencies.loadControllerContext && controllerContext) {
            controllerContext = undefined;
            lastReport = undefined;
            lastCompletion = undefined;
            recoveryPlan = undefined;
            engine.setTask(event.prompt.slice(0, 65536), engine.stage);
          }
          if (!controllerContext && (!engine.task || engine.task.startsWith('Task stage '))) {
            engine.setTask(event.prompt.slice(0, 65536), engine.stage);
            pi.appendEntry(TASK_HISTORY_TYPE, { stage: engine.stage, task: engine.task });
          }
          workerToolNames.length = 0;
        }
        if (event.messageType === 'custom') workerState = 'Recovering';
      } catch {
        if (event.messageType === 'user' && dependencies.loadControllerContext) {
          controllerContext = undefined;
          lastReport = undefined;
          lastCompletion = undefined;
          recoveryPlan = undefined;
        }
      }
    });

    pi.on('tool_execution_start', event => {
      try {
        if (pendingArgs.size >= 32) pendingArgs.delete(pendingArgs.keys().next().value!);
        pendingArgs.set(event.toolCallId, { preview: JSON.stringify(event.args ?? {}).slice(0, 256),
          signature: operationSignature(event.toolName, event.args) });
      } catch { /* Capture is best effort. */ }
    });

    pi.on('tool_execution_end', (event: ToolExecutionEndEvent, ctx) => {
      try {
        workerToolNames.push(event.toolName);
        const args = pendingArgs.get(event.toolCallId);
        pendingArgs.delete(event.toolCallId);
        if (event.result?.terminate === true) terminating.add(event.toolCallId);
        const observation = { toolCallId: event.toolCallId, toolName: event.toolName,
          args: args?.preview, operationKey: args?.signature,
          result: event.result, isError: event.isError, durationMs: event.durationMs };
        const classification = classifyObservation(observation);
        const trigger = engine.observe(observation);
        if (lastAdviceEpoch !== undefined && classification.kind === 'PROGRESS' &&
            event.toolName === lastAdviceTool && engine.progressVersion > lastAdviceEpoch) {
          workerRecoveries++;
          try { pi.appendEntry(WORKER_RECOVERY_TYPE, { tool: event.toolName, progressVersion: engine.progressVersion }); }
          catch { /* Observation is best effort. */ }
          lastAdviceEpoch = undefined;
          lastAdviceTool = undefined;
          lastAdviceOperation = undefined;
          repeatedAfterAdvice = 0;
          view.finish('ready', 'Worker recovery observed: saved change');
          render(ctx);
        } else if (lastAdviceEpoch !== undefined && args?.signature === lastAdviceOperation &&
            (classification.kind === 'NO_CHANGE' || classification.kind === 'ERROR')) {
          repeatedAfterAdvice++;
          if (repeatedAfterAdvice === limits.maxRepeatedIneffectiveOps) {
            view.finish('error', 'Loop unresolved: Worker repeated the proven ineffective operation');
            ctx.ui.notify('Pi Sitter: loop unresolved; Worker repeated the ineffective operation after guidance', 'warning');
            render(ctx);
          }
        }
        if (trigger) recordTrigger(trigger, ctx);
      } catch { /* Never change a Worker result or call. */ }
    });

    pi.on('context', event => {
      for (const message of event.messages) {
        if (message.role !== 'custom' || message.customType !== ADVISORY_TYPE ||
            typeof message.content !== 'string' || !awaitingContext.has(message.content)) continue;
        awaitingContext.delete(message.content);
        confirmedDeliveries++;
        try { pi.appendEntry(DELIVERY_CONFIRM_TYPE, { stage: engine.stage, confirmed: true }); }
        catch { /* Context confirmation remains best effort. */ }
      }
    });

    pi.on('agent_settled', (_event, ctx) => {
      if (!awaitingContext.size) return;
      failedDeliveries += awaitingContext.size;
      try { pi.appendEntry(DELIVERY_FAILURE_TYPE, { stage: engine.stage, count: awaitingContext.size }); }
      catch { /* Failure remains visible in status. */ }
      awaitingContext.clear();
      view.finish('error', 'Advisory was committed but no following model context was observed');
      render(ctx);
    });

    pi.on('turn_end', async (event, ctx) => {
      if (lastRecovery && event.message.role === 'assistant') recoveryTurnObserved = true;
      if (!pending) return;
      const trigger = pending;
      pending = undefined;
      if (event.outcome !== 'completed' || engine.mode === 'off') return;
      try {
        const safeContinuation = event.message.role === 'assistant' && event.message.stopReason === 'toolUse' && event.toolResults.length > 0 &&
          !event.toolResults.every(result => terminating.has(result.toolCallId));
        const diagnosed = remaining() > 0 ? await diagnose(trigger, ctx) : undefined;
        if (diagnosed?.stale) return;
        terminating.clear();
        const modelOutcome = diagnosed?.outcome;
        let outcome: InferenceOutcome = modelOutcome ?? { kind: 'failed', latencyMs: 0, reason: 'Inference budget exhausted' };
        let source: OutcomeEntry['source'] = 'model';
        if (outcome.kind !== 'ready' || modelAdvisories >= limits.maxValidAdvisories) {
          if (fallbackAdvisories < limits.maxFallbackAdvisories) {
            const fallback = fallbackFor(trigger);
            if (fallback) {
              outcome = { kind: 'ready', diagnosis: fallback, latencyMs: 0,
                reason: modelOutcome?.reason ? `Fallback after ${modelOutcome.reason}` : 'Deterministic fallback selected' };
              source = 'fallback';
              supervisorActivity = 'Deterministic fallback selected';
              view.finish('ready', `Fallback: ${fallback.issue} — ${fallback.next_action}`);
              render(ctx);
            }
          }
        }
        if (outcome.kind !== 'ready' || diagnosed?.modeAtStart === 'off' || engine.mode !== 'active') {
          if (outcome.kind !== 'ready') {
            view.finish('error', outcome.reason ?? 'Diagnosis failed; no grounded fallback available');
            ctx.ui.notify(`Pi Sitter diagnosis failed: ${outcome.reason ?? 'no grounded fallback available'}`, 'warning');
          }
          try { recordOutcome(trigger, outcome, outcome.kind, source); render(ctx); } catch { /* Metadata is best effort. */ }
          return;
        }
        if (!safeContinuation) {
          failedDeliveries++;
          view.finish('error', 'Advisory could not enter a continuing Worker turn');
          recordOutcome(trigger, outcome, 'delivery_failed', source);
          render(ctx);
          return;
        }
        const diagnosis = outcome.diagnosis!;
        const adviceKey = `${diagnosis.issue.toLowerCase()}|${diagnosis.next_action.toLowerCase()}`;
        if (adviceKeys.has(adviceKey)) {
          view.finish('abstained', 'Duplicate advisory suppressed');
          recordOutcome(trigger, outcome, 'duplicate', source);
          render(ctx);
          return;
        }
        adviceKeys.add(adviceKey);
        delivered++;
        if (source === 'fallback') fallbackAdvisories++;
        else modelAdvisories++;
        lastAdviceEpoch = engine.progressVersion;
        lastAdviceTool = trigger.tool;
        lastAdviceOperation = engine.recent.at(-1)?.operationKey;
        repeatedAfterAdvice = 0;
        view.finish('delivered', `${diagnosis.issue} — ${diagnosis.next_action}`);
        supervisorActivity = source === 'fallback' ? 'Fallback delivered; Worker continuing' : 'Advisory delivered; Worker continuing';
        try { recordOutcome(trigger, outcome, 'delivered', source); render(ctx); } catch { /* Metadata is best effort. */ }
        const content = advisoryText(trigger, outcome);
        awaitingContext.add(content);
        return { entries: [...event.entries, { type: 'custom_message' as const,
          customType: ADVISORY_TYPE, content, display: false } ] };
      } catch (error) {
        failedDeliveries++;
        view.finish('error', `Delivery failed: ${error instanceof Error ? error.message.slice(0, 100) : 'unknown error'}`);
        render(ctx);
      }
    });

    pi.on('agent_before_settle', (event, ctx) => {
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage ||
          !(dependencies.verify || process.env.PI_SITTER_VERIFY_COMMAND)) return;
      try {
        const request = dependencies.loadCheckpoint?.(engine.stage, ctx.cwd);
        const raw = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
        if (request?.reason === 'milestone' && raw) {
          const authoritative = validateControllerContext(raw, engine.stage);
          const selected = selectCheckpoint(authoritative, request, lastReport);
          const key = [selected.taskId, selected.milestoneId, selected.snapshotId,
            authoritative.suite.digest, selected.reason].join(':');
          if (completedCheckpoints.has(key)) return;
        }
      } catch { /* Verification records the authoritative BLOCKED result. */ }
      beginPendingVerification(ctx);
    });

    pi.on('agent_before_settle', async (event, ctx) => {
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage || !dependencies.milestoneValidators ||
          !(dependencies.milestoneReady?.(engine.milestones) ?? engine.milestones.length > 0)) return;
      try {
        const trigger = engine.milestone({ stage: engine.stage, gameDir: ctx.cwd, final: true }, dependencies.milestoneValidators);
        if (!trigger) return;
        recordTrigger(trigger, ctx);
        pending = undefined;
        // A completed Worker run is never restarted just to deliver late advice.
        const { outcome, stale } = await diagnose(trigger, ctx);
        if (stale) return;
        try { recordOutcome(trigger, outcome); } catch { /* Metadata is best effort. */ }
      } catch { /* Validation and inference are advisory only. */ }
    });

    pi.on('agent_before_settle', async (event, ctx) => {
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage || !(dependencies.verify || process.env.PI_SITTER_VERIFY_COMMAND)) return;
      const prerequisite = dependencies.completionReady?.(workerToolNames, pi.getActiveTools());
      if (prerequisite) {
        const completion: CompletionRecord = { stage: engine.stage, task: engine.task, decision: 'BLOCKED',
          snapshotIdentity: 'unavailable', counts: { PASS: 0, FAIL: 0, UNVERIFIED: 0 },
          failedGateIds: [], unverifiedGateIds: [], regressions: [], attempt: recoveryAttempts,
          elapsedMs: 0, reason: prerequisite };
        appendCompletion(ctx, completion);
        lastCompletion = completion;
        verificationActivity = 'Worker tool access blocked';
        render(ctx);
        return;
      }
      let request: CheckpointRequest = { reason: 'final', milestoneId: 'final' };
      try {
        const supplied = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
        const currentContext = supplied && validateControllerContext(supplied, engine.stage);
        if (currentContext && lastReport?.schemaVersion === 2 && lastReport.taskId === currentContext.taskId &&
            lastReport.suite.digest === currentContext.suite.digest &&
            lastReport.gates.some(gate => gate.result === 'FAIL') &&
            lastReport.snapshotIdentity !== currentContext.sourceSnapshot) {
          request = { reason: 'post_repair', milestoneId: 'repair',
            gateIds: lastReport.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
            regressionGateIds: lastReport.gates.filter(gate => gate.result === 'PASS').map(gate => gate.id) };
        }
        request = dependencies.loadCheckpoint?.(engine.stage, ctx.cwd) ?? request;
      } catch { /* verify records a BLOCKED result using the same trusted ingress. */ }
      const { report, completion } = await verify(ctx, request);
      if (!report || !completion) return;
      if (report.snapshotIdentity !== 'unavailable' && dependencies.evidenceBroker &&
          dependencies.shouldAnalyze?.(report) && completionDiagnosisCalls < 1) {
        const current = new AbortController();
        analysisController = current;
        const sessionId = engine.sessionId;
        supervisorActivity = 'Inspecting ambiguous evidence';
        render(ctx);
        try {
          const analyze = dependencies.analyze ?? runInspectionAnalysis;
          const broker = dependencies.evidenceBroker(ctx.cwd);
          let ask = modelAnalysisAsk(ctx, dependencies.loadedCheck);
          let closeResearch: (() => Promise<void>) | undefined;
          if (report.schemaVersion === 2 && dependencies.mcpReadHost) {
            const supplied = dependencies.mcpReadHost(report.taskId, report.snapshotIdentity);
            if (supplied) {
              const snapshot = await broker.openSnapshot(current.signal, { taskId: report.taskId, turnId: report.runId });
              if (snapshot.identity !== report.snapshotIdentity) {
                await snapshot.close();
                throw new Error('MCP research snapshot is stale');
              }
              try {
                const session = await openSupervisorSession(ctx, snapshot, {
                  allowedMcpTools: [], instructions: 'Investigate only the unresolved task gates.',
                  mcpRead: { ...supplied, taskId: report.taskId, turnId: report.runId,
                    sourceIdentity: report.snapshotIdentity,
                    getWorkerTools: () => pi.getAllTools() },
                }, current.signal);
                ask = async prompt => {
                  const turn = await session.prompt(prompt);
                  return { text: turn.text, evidence: turn.receipts.filter(receipt =>
                    receipt.tool === 'pi_sitter_mcp_read').map(receipt => receipt.text) };
                };
                closeResearch = async () => { await session.close(); await snapshot.close(); };
              } catch (error) { await snapshot.close(); throw error; }
            }
          }
          let result: AnalysisOutcome;
          try { result = await analyze(report, broker, ask, current.signal,
            { onInspections: (requests, results) => pi.appendEntry(EVIDENCE_REQUEST_TYPE,
              { snapshotIdentity: report.snapshotIdentity, requests, results }) }); }
          finally { await closeResearch?.(); }
          if (!current.signal.aborted && sessionId === engine.sessionId) {
            completionDiagnosisCalls += Math.min(1, result.calls);
            recoveryGenerationCalls += Math.max(0, result.calls - 1);
            pi.appendEntry(ANALYSIS_TYPE, result);
            if (recoveryPlan) recoveryPlan = applyRecoveryAnalysis(recoveryPlan, report, result);
          }
        } catch (error) {
          if (!current.signal.aborted) {
            completionDiagnosisCalls++;
            pi.appendEntry(ANALYSIS_TYPE, { kind: 'failed', calls: 1, inputTokens: 0, outputTokens: 0,
              elapsedMs: 0, requests: [], results: [], reason: error instanceof Error ? error.message : 'analysis failed' });
          }
        } finally {
          if (analysisController === current) analysisController = undefined;
          supervisorActivity = 'Idle';
          render(ctx);
        }
      }
      if (completion.decision !== 'RECOVERY_REQUIRED' || !recoveryPlan) return;
      if (noProgressRetryReady(report)) {
        const retry = beginNoProgressRetry(ctx);
        return { entries: [...event.entries,
          { type: 'custom' as const, customType: RECOVERY_TYPE, data: retry },
          { type: 'custom_message' as const, customType: RECOVERY_MESSAGE_TYPE,
            content: noProgressRecoveryPrompt(recoveryPlan), display: false }], continue: true };
      }
      if (engine.mode !== 'active' || recoveryAttempts >= limits.maxRecoveryAttempts || recoveryKeys.has(recoveryPlan.key)) return;
      const plan = recoveryPlan;
      const attempt = recoveryAttempts + 1;
      recoveryAttempts = attempt;
      recoveryKeys.add(plan.key);
      lastRecovery = { attempt, plan, delivery: 'committed_for_continuation' };
      recoveryTurnObserved = false;
      workerState = 'Recovering';
      verificationActivity = `Recovery ${attempt} queued at completion boundary`;
      render(ctx);
      return { entries: [...event.entries,
        { type: 'custom' as const, customType: RECOVERY_TYPE, data: lastRecovery },
        { type: 'custom_message' as const, customType: RECOVERY_MESSAGE_TYPE, content: plan.text, display: false }],
        continue: true };
    });

    pi.on('agent_settled', (_event, ctx) => {
      if (pendingVerificationId) {
        verificationCards.set(pendingVerificationId, 'interrupted');
        pendingVerificationId = undefined;
      }
      if (ctx.hasUI) {
        ctx.ui.setWorkingMessage();
        ctx.ui.setWorkingVisible(false);
        ctx.ui.setWorkingVisible(true);
      }
    });

    pi.on('session_shutdown', (_event, ctx) => {
      try {
        controller?.abort(new Error('Pi Sitter session ended'));
        verificationController?.abort(new Error('Pi Sitter session ended'));
        analysisController?.abort(new Error('Pi Sitter session ended'));
        stopUI();
        pending = undefined;
        if (ctx.hasUI) {
          ctx.ui.setWidget(WIDGET_KEY, undefined);
          ctx.ui.setStatus(STATUS_KEY, undefined);
        }
        engine.reset(initialMode());
        view.reset();
        pendingArgs.clear();
        terminating.clear();
        adviceKeys.clear();
        workerToolNames.length = 0;
        controller = undefined;
        verificationController = undefined;
        analysisController = undefined;
        lastReport = undefined;
        lastCompletion = undefined;
        verificationCards.clear();
        pendingVerificationId = undefined;
        recoveryCards.clear();
        recoveryPlan = undefined;
        recoveryAttempts = 0;
        verificationRuns = 0;
        recoveryKeys.clear();
        lastRecovery = undefined;
        recoveryTurnObserved = false;
        completionDiagnosisCalls = recoveryGenerationCalls = 0;
        validDiagnoses = modelAdvisories = fallbackAdvisories = failedDeliveries = workerRecoveries = confirmedDeliveries = 0;
        lastAdviceEpoch = undefined;
        lastAdviceTool = undefined;
        lastAdviceOperation = undefined;
        repeatedAfterAdvice = 0;
        lastRejectedReason = '';
        awaitingContext.clear();
        lastRenderAt = 0;
        lastStatus = lastWidget = '';
      } catch { /* Teardown cannot block session replacement or quit. */ }
    });

    pi.registerCommand('sitter', {
      description: 'Pi Sitter: status, gates, report, recover, verify, off, shadow, on',
      getArgumentCompletions: prefix => ['status', 'gates', 'report', 'recover', 'verify', 'off', 'shadow', 'on']
        .filter(value => value.startsWith(prefix)).map(value => ({ value, label: value })),
      handler: async (args, ctx) => {
        try {
          const command = args.trim().toLowerCase();
          if (!command) view.toggle();
          else if (command === 'verify') {
            const unavailable = !ctx.isIdle() ? 'Run /sitter verify after the Worker turn completes' :
              verificationController ? 'Pi Sitter verification is already running' :
              !engine.stage ? 'Set a task stage before verification' :
              verificationRuns >= limits.maxCompletionVerifications ? 'Completion verification budget exhausted' : undefined;
            if (unavailable) {
              showUnavailableVerification(unavailable);
              ctx.ui.notify(unavailable, 'warning');
            } else {
              beginPendingVerification(ctx);
              try { await verify(ctx); }
              finally {
                if (pendingVerificationId) {
                  verificationCards.set(pendingVerificationId, 'interrupted');
                  pendingVerificationId = undefined;
                }
                if (ctx.hasUI) {
                  ctx.ui.setWorkingMessage();
                  ctx.ui.setWorkingVisible(false);
                  ctx.ui.setWorkingVisible(true);
                }
              }
            }
          }
          else if (command === 'status') {
            ctx.ui.notify(`Pi Sitter ${engine.mode}; Worker ${workerState}; stage ${engine.stage || 'unset'}; gates ${lastCompletion?.decision ?? 'pending'}; ${verificationActivity}; verification ${verificationElapsedMs} ms (${verificationRuns}/${limits.maxCompletionVerifications}); recovery ${recoveryAttempts}/${limits.maxRecoveryAttempts}; diagnosis ${completionDiagnosisCalls}/1; recovery generation ${recoveryGenerationCalls}/1; unresolved ${lastCompletion?.failedGateIds.concat(lastCompletion?.unverifiedGateIds ?? []).join(', ') || 'none'}; status ${view.phase}${view.result ? `: ${view.result}` : ''}; last rejected ${lastRejectedReason || "none"}; triggers ${engine.triggerCount}; inference ${calls}/${limits.maxInferenceAttempts}; valid ${validDiagnoses}; model delivered ${modelAdvisories}/${limits.maxValidAdvisories}; fallback delivered ${fallbackAdvisories}/${limits.maxFallbackAdvisories}; delivered ${delivered}; confirmed ${confirmedDeliveries}; failed deliveries ${failedDeliveries}; Worker recoveries ${workerRecoveries}; abstained ${abstained}; failed ${failed}; budget ${remaining()}; tokens ${inputTokens}/${outputTokens}; latency ${totalLatencyMs} ms; observer ${engine.overheadMs.toFixed(1)} ms`, 'info');
          } else if (command === 'gates') {
            const gates = controllerContext?.suite.gates ?? [];
            ctx.ui.notify(gates.length ? `Host-provided protected gates for ${engine.stage}:\n${gates.map(gate => `${gate.id}: ${lastReport?.gates.find(row => row.id === gate.id)?.result ?? 'PENDING'} — requirements ${gate.requirementIds.join(', ')}`).join('\n')}` : 'No trusted gate contract is available for this stage', gates.length ? 'info' : 'warning');
          } else if (command === 'report') {
            const unresolved = lastReport?.gates.filter(gate => gate.result !== 'PASS') ?? [];
            ctx.ui.notify(lastCompletion ? `Stage ${lastCompletion.stage}: ${lastCompletion.decision}; ${lastCompletion.counts.PASS} PASS, ${lastCompletion.counts.FAIL} FAIL, ${lastCompletion.counts.UNVERIFIED} UNVERIFIED; regressions: ${lastCompletion.regressions.join(', ') || 'none'}; snapshot ${lastCompletion.snapshotIdentity}; ${lastCompletion.reason}${lastReport?.supervisorSessionFile ? `\nSupervisor Pi transcript: ${lastReport.supervisorSessionFile}` : ''}${unresolved.length ? `\nUnresolved gates:\n${unresolved.map(gate => `${gate.id} ${gate.result}: ${gate.evidence}`).join('\n')}` : ''}${lastReport?.validationLimitations.length ? `\nLimitations: ${lastReport.validationLimitations.join('; ')}` : ''}` : 'No verification report is available', lastCompletion ? 'info' : 'warning');
          } else if (command === 'recover') {
            const unavailable = !recoveryPlan || lastCompletion?.decision !== 'RECOVERY_REQUIRED' ? 'No failed gate recovery is pending' :
              !ctx.isIdle() ? 'Run /sitter recover after the Worker is idle' :
              engine.mode === 'off' ? 'Enable Pi Sitter before recovery' : undefined;
            const request: RecoveryRequest = { id: randomUUID(), stage: engine.stage, reset: !unavailable, unavailable };
            if (!unavailable) recoveryCards.set(request.id, undefined);
            pi.appendEntry(RECOVERY_REQUEST_TYPE, request);
            if (unavailable) ctx.ui.notify(unavailable, 'warning');
            else {
              startUserCompletionCycle();
              const plan = recoveryPlan!;
              const attempt = ++recoveryAttempts;
              recoveryKeys.add(plan.key);
              lastRecovery = { attempt, plan, delivery: 'queued_manual', displayId: request.id };
              recoveryTurnObserved = false;
              pi.appendEntry(RECOVERY_TYPE, lastRecovery);
              pi.sendMessage({ customType: RECOVERY_MESSAGE_TYPE, content: plan.text, display: false }, { triggerTurn: true, deliverAs: 'followUp' });
              recoveryCards.set(request.id, lastRecovery);
              workerState = 'Recovering';
              ctx.ui.notify(`Recovery attempt ${attempt}/${limits.maxRecoveryAttempts} queued for the current Worker model; delivery is pending`, 'info');
            }
          } else if (command === 'off' || command === 'shadow' || command === 'on') {
            if (command === 'off') {
              controller?.abort(new Error('Pi Sitter disabled'));
              verificationController?.abort(new Error('Pi Sitter disabled'));
              analysisController?.abort(new Error('Pi Sitter disabled'));
              pending = undefined;
              stopUI();
              view.reset();
            }
            const mode = command === 'on' ? 'active' : command;
            engine.setMode(mode);
            pi.appendEntry(MODE_TYPE, mode);
            ctx.ui.notify(`Pi Sitter ${mode}`, 'info');
          } else ctx.ui.notify('Use /sitter [status|gates|report|recover|verify|off|shadow|on]', 'info');
          render(ctx);
        } catch (error) {
          ctx.ui.notify(`Pi Sitter command could not complete: ${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}`, 'warning');
        }
      },
    });
  };
}

export default function piSitter(pi: ExtensionAPI): void { createPiSitter()(pi); }
