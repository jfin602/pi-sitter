import type { ExtensionAPI, ExtensionContext, Theme, ToolExecutionEndEvent } from '@earendil-works/pi-coding-agent';
import { randomUUID } from 'node:crypto';
import { PiSitterEngine, classifyObservation, operationSignature, resultFingerprint, type Trigger, type PiSitterMode, type Validator } from './core.ts';
import { piSitterLimits, type PiSitterLimits } from './config.ts';
import { parseDiagnosis, runInference, type Diagnosis, type InferenceOutcome, type LoadedCheck } from './inference.ts';
import { genericFallback, type FallbackProvider } from './fallback.ts';
import { PiSitterView } from './view.ts';
import { normalizeGateReport, type GateReport, type GateSet } from './gates.ts';
import { adaptVitestReport } from './vitest-report.ts';
import { validateControllerContext, type ControllerContext } from './controller-context.ts';
import { applyRecoveryAnalysis, createRecoveryPlan, decideCompletion, noProgressRecoveryPrompt, validateRequirementReview,
  type CompletionRecord, type RecoveryPlan, type RequirementReview } from './completion.ts';
import { EvidenceBroker, type EvidenceSnapshot } from './broker.ts';
import { openSupervisorSession } from './supervisor-session.ts';
import type { McpReadHost } from './mcp-read.ts';
import { modelAnalysisAsk, runInspectionAnalysis, type AnalysisOutcome } from './analysis.ts';
import { buildPrompt, type PromptBuilder } from './prompt.ts';
import { configuredVerifier } from './verifier.ts';
import type { ApprovedVerifier } from './verifier.ts';
import { checkpointContext, selectCheckpoint, type CheckpointRequest } from './checkpoints.ts';
import { discoverProjectTestCommand, type TestDiscovery } from './test-discovery.ts';
import { approvedPlanId, assessVerificationReadiness, configuredPlanId, testCommandNotice,
  type VerificationReadiness } from './verification-readiness.ts';
import { InterventionLifecycle, type InterventionEvent } from './intervention-lifecycle.ts';
import { buildWorkerDirective, isInspectionLoop, triggerObservation, weakLoopAction,
  type DiagnosticEvidence } from './intervention-directive.ts';
import { buildProjectDiagnosticPrompt } from './project-diagnostic-prompt.ts';
import { diagnosticFinding, readableMarkdown, safeRawLines } from './diagnostic-presentation.ts';

const STATUS_KEY = 'pi-sitter-status';
const WIDGET_KEY = 'pi-sitter-panel';
const EVENT_TYPE = 'pi-sitter-event';
const MODE_TYPE = 'pi-sitter-mode';
const CALL_TYPE = 'pi-sitter-call';
const OUTCOME_TYPE = 'pi-sitter-outcome';
const INTERVENTION_TYPE = 'pi-sitter-intervention';
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
const STARTUP_TYPE = 'pi-sitter-startup';
const READINESS_TYPE = 'pi-sitter-readiness';
const EMPTY_FINAL_TYPE = 'pi-sitter-empty-final';
const EMPTY_FINAL_MESSAGE_TYPE = 'pi-sitter-empty-final-followup';
const PROJECT_DIAGNOSTIC_TYPE = 'pi-sitter-project-diagnostic';
const PROJECT_DIAGNOSTIC_PENDING_TYPE = 'pi-sitter-project-diagnostic-pending';
const PROJECT_DIAGNOSTIC_RETRY_TYPE = 'pi-sitter-project-diagnostic-retry';
const MAX_NO_PROGRESS_RETRIES = 1;
interface EmptyFinalEntry { stage: string; messageEntryId: string; phase: 'continuing' | 'stopped' }
export interface ProjectDiagnosticResult {
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  suite?: string;
  passed: number;
  failed: number;
  total: number;
  failures?: { id: string; detail: string; expected?: string; observed?: string; path?: string }[];
  reason?: string;
}
type ProjectDiagnosticCard = ProjectDiagnosticResult & {
  stage: string;
  progressVersion?: number;
  displayId?: string;
  workerPrompt?: string;
  previousWorkerPrompt?: string;
  followupPending?: boolean;
  followup?: ProjectDiagnosticResult;
  workerProgressObserved?: boolean;
  guidanceReceived?: boolean;
  guidanceDeliveryFailed?: boolean;
  rawResult?: ProjectDiagnosticResult;
  rawFollowup?: ProjectDiagnosticResult;
  followupProgressVersion?: number;
};
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
  hint?: string;
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
  const rows: { text: string; kind?: 'title' | 'status' | 'hint' }[] = [
    { text: ' Pi Sitter', kind: 'title' },
    { text: ` Stage ${card.stage ?? 'not recorded'}` },
    { text: ` ${card.status}`, kind: 'status' },
    { text: '' },
    { text: ` ${card.summary}` },
    ...(card.details?.length ? [{ text: '' }, ...card.details.map(text => ({ text: ` ${text}` }))] : []),
    ...(card.hint ? [{ text: '' }, { text: ` ${card.hint}`, kind: 'hint' as const }] : []),
  ];
  const wrapped = rows.flatMap(row => row.text.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).split('\n').flatMap(text => {
    const parts: typeof rows = [];
    let chars = Array.from(text);
    while (chars.length > width) {
      let breakAt = chars.slice(0, width).lastIndexOf(' ');
      if (breakAt < 1) breakAt = width;
      else breakAt++;
      parts.push({ text: chars.slice(0, breakAt).join(''), kind: row.kind });
      chars = chars.slice(breakAt);
    }
    parts.push({ text: chars.join(''), kind: row.kind });
    return parts;
  }));
  return [spacer, ...wrapped.map(row => {
    const padding = ' '.repeat(width - Array.from(row.text).length);
    return theme.style(row.text + padding, {
      fg: row.kind === 'title' ? titleFg : row.kind === 'status' ? statusFg : row.kind === 'hint' ? 'muted' : fg,
      bg, bold: row.kind === 'title' || row.kind === 'status',
    });
  }), spacer];
}

interface OutcomeEntry {
  interventionId?: string;
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
  /** Host-owned source inspection review; positive and negative findings need current allowed receipts. */
  reviewRequirements?: (context: ControllerContext, report: GateReport,
    snapshot: Pick<EvidenceSnapshot, 'identity' | 'inspect'>,
    signal: AbortSignal) => Promise<unknown>;
  /** Host-owned execution registry; the environment setting supplies only its identifier. */
  resolveApprovedVerifier?: (id: string, checkpoint?: import('./checkpoints.ts').CheckpointSelection) => ApprovedVerifier | undefined;
  /** A trusted host may select only an ID from its own approved verifier registry. */
  verificationSetup?: {
    getSelectedPlanId?: (stage: string, projectRoot: string) => string | undefined;
    selectApprovedPlan?: (id: string, stage: string, projectRoot: string) => void;
    preflight?: (stage: string, projectRoot: string, planId?: string) => { ready: boolean; reason?: string };
  };
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
  /** Host-run project diagnostic. Its result guides repair but never authorizes protected gates. */
  projectDiagnostic?: (stage: string, projectRoot: string, signal: AbortSignal) => Promise<ProjectDiagnosticResult>;
}

function initialMode(): PiSitterMode {
  return process.env.PI_SITTER_MODE === 'active' ? 'active'
    : process.env.PI_SITTER_MODE === 'shadow' ? 'shadow' : 'off';
}

async function withAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason ?? new Error('Operation canceled');
  let onAbort: (() => void) | undefined;
  const canceled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason ?? new Error('Operation canceled'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([work, canceled]); }
  finally { if (onAbort) signal.removeEventListener('abort', onAbort); }
}

function boundedProjectDiagnostic(value: ProjectDiagnosticResult): ProjectDiagnosticResult {
  if (!value || !['PASS', 'FAIL', 'BLOCKED'].includes(value.status) ||
      ![value.passed, value.failed, value.total].every(n => Number.isInteger(n) && n >= 0 && n <= 100_000) ||
      value.passed + value.failed > value.total ||
      value.status === 'PASS' && (value.failed !== 0 || value.total === 0 || value.passed !== value.total) ||
      value.status === 'FAIL' && value.failed === 0)
    throw new Error('Host diagnostic returned an invalid result');
  return { status: value.status, suite: typeof value.suite === 'string' ? value.suite.slice(0, 120) : undefined,
    passed: value.passed, failed: value.failed, total: value.total,
    failures: Array.isArray(value.failures) ? [...value.failures].sort((a, b) =>
      Number(/\b(?:missing|saved|container|script=|root=|not found|does not exist)/i.test(b.detail)) -
      Number(/\b(?:missing|saved|container|script=|root=|not found|does not exist)/i.test(a.detail)))
      .slice(0, 20).map(row => ({
      id: String(row.id).slice(0, 160), detail: String(row.detail).slice(0, 600),
      ...(typeof row.expected === 'string' ? { expected: row.expected.slice(0, 4096) } : {}),
      ...(typeof row.observed === 'string' ? { observed: row.observed.slice(0, 4096) } : {}),
      ...(typeof row.path === 'string' ? { path: row.path.slice(0, 4096) } : {}) })) : [],
    reason: typeof value.reason === 'string' ? value.reason.slice(0, 800) : undefined };
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
    const interventions = new InterventionLifecycle();
    const workerToolNames: string[] = [];
    let pending: Trigger | undefined;
    let controller: AbortController | undefined;
    let verificationController: AbortController | undefined;
    let analysisController: AbortController | undefined;
    let projectDiagnosticController: AbortController | undefined;
    let lastReport: GateReport | undefined;
    let controllerContext: ControllerContext | undefined;
    let lastCompletion: CompletionRecord | undefined;
    let testDiscovery: TestDiscovery = { kind: 'unknown', reason: 'Project has not been inspected' };
    let noTestsMode = false;
    let selectedPlanId: string | undefined;
    let readinessState: VerificationReadiness | undefined;
    let readinessSignature = '';
    let configurationError: string | undefined;
    let controllerConfigurationError: string | undefined;
    let emptyFinalContinuationIssued = false;
    let emptyFinalTerminalIssued = false;
    let unavailableAtCompletionIssued = false;
    let projectDiagnosticRetryIssued = false;
    let lastProjectDiagnosticPrompt: string | undefined;
    let lastDiagnostic: DiagnosticEvidence | undefined;
    const handledEmptyFinalMessages = new Set<string>();
    const verificationCards = new Map<string, CompletionRecord | 'interrupted' | undefined>();
    const diagnosticCards = new Map<string, ProjectDiagnosticCard | 'interrupted' | undefined>();
    let pendingDiagnosticId: string | undefined;
    let activeDiagnosticId: string | undefined;
    let pendingVerificationId: string | undefined;
    const recoveryCards = new Map<string, RecoveryEntry | 'interrupted' | undefined>();
    let recoveryPlan: RecoveryPlan | undefined;
    let recoveryAttempts = 0;
    let verificationRuns = 0;
    const completedCheckpoints = new Set<string>();
    const seenRunIds = new Set<string>();
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
    const contextInterventionIds = new Map<string, string>();
    const receivedInterventions = new Set<string>();
    const failedInterventions = new Set<string>();
    const actedInterventions = new Set<string>();
    let lastAdviceInterventionId: string | undefined;
    let lastAdviceEpoch: number | undefined;
    let lastAdviceTool: string | undefined;
    let lastAdviceOperation: string | undefined;
    let lastAdviceInspectionReceipt: string | undefined;
    let lastObservedResultFingerprint: string | undefined;
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
      emptyFinalContinuationIssued = false;
      emptyFinalTerminalIssued = false;
      unavailableAtCompletionIssued = false;
      projectDiagnosticRetryIssued = false;
      activeDiagnosticId = undefined;
      lastProjectDiagnosticPrompt = undefined;
      lastDiagnostic = undefined;
      handledEmptyFinalMessages.clear();
    }

    function protectedVerifierAvailable(): boolean {
      return Boolean(controllerContext && (dependencies.verify ||
        (selectedPlanId && dependencies.resolveApprovedVerifier)));
    }

    function verifierRequested(): boolean {
      return Boolean(dependencies.verify || selectedPlanId || process.env.PI_SITTER_VERIFY_COMMAND);
    }

    function refreshSelectedPlan(ctx: ExtensionContext): void {
      try {
        const fromHost = dependencies.verificationSetup?.getSelectedPlanId;
        selectedPlanId = fromHost ? fromHost(engine.stage, ctx.cwd) : configuredPlanId(process.env.PI_SITTER_VERIFY_COMMAND);
        if (selectedPlanId) selectedPlanId = approvedPlanId(selectedPlanId);
        configurationError = controllerConfigurationError;
      } catch (error) {
        selectedPlanId = undefined;
        configurationError = error instanceof Error ? error.message : 'Invalid verifier selection';
      }
    }

    function refreshReadiness(ctx: ExtensionContext): VerificationReadiness {
      refreshTestDiscovery(ctx);
      refreshSelectedPlan(ctx);
      let hostCheck: { ready: boolean; reason?: string } | undefined;
      try { hostCheck = dependencies.verificationSetup?.preflight?.(engine.stage, ctx.cwd, selectedPlanId); }
      catch (error) { hostCheck = { ready: false, reason: error instanceof Error ? error.message : 'Host preflight failed' }; }
      readinessState = assessVerificationReadiness({ candidate: testDiscovery,
        controller: !!controllerContext,
        verifier: Boolean(dependencies.verify || selectedPlanId && dependencies.resolveApprovedVerifier),
        requirementReview: Boolean(dependencies.reviewRequirements && dependencies.evidenceBroker),
        planId: selectedPlanId, hostCheck, configurationError });
      return readinessState;
    }

    function announceReadiness(ctx: ExtensionContext): void {
      if (engine.mode === 'off') return;
      const value = refreshReadiness(ctx);
      const signature = `${ctx.sessionManager.getSessionId()}:${engine.stage}:${value.status}:${value.summary}`;
      readinessSignature = signature;
      if (ctx.sessionManager.getBranch().some(entry => entry.type === 'custom' &&
          entry.customType === READINESS_TYPE && (entry.data as { signature?: string } | undefined)?.signature === signature)) return;
      pi.appendEntry(READINESS_TYPE, { signature, stage: engine.stage, ...value });
      const notice = testCommandNotice(value);
      if (ctx.hasUI && notice.warning) ctx.ui.notify(notice.summary, 'warning');
    }

    function unavailableAtCompletionReason(): string {
      const candidate = testDiscovery.kind === 'candidate' ?
        ` Found ${testDiscovery.command}, but Pi Sitter did not run it as final validation.` : '';
      return `Final test result unavailable: the host has not configured an approved verifier.${candidate} No passing result was recorded.`;
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

    function sameAttempt(report: GateReport | undefined, completion: CompletionRecord | undefined): boolean {
      return !!report && report.schemaVersion === 2 && !!completion &&
        completion.taskId === report.taskId && completion.stage === report.stage &&
        completion.runId === report.runId && completion.snapshotIdentity === report.snapshotIdentity &&
        completion.suite?.id === report.suite.id && completion.suite.version === report.suite.version &&
        completion.suite.digest === report.suite.digest &&
        completion.milestoneId === report.checkpoint?.milestoneId;
    }

    function currentRecovery(): boolean {
      return sameAttempt(lastReport, lastCompletion) && lastCompletion?.decision === 'RECOVERY_REQUIRED' &&
        !!recoveryPlan && recoveryPlan.diagnosis.run === lastCompletion.runId &&
        recoveryPlan.diagnosis.suite?.id === lastCompletion.suite?.id &&
        recoveryPlan.diagnosis.suite?.version === lastCompletion.suite?.version &&
        recoveryPlan.diagnosis.suite?.digest === lastCompletion.suite?.digest;
    }

    function unresolvedIds(): string[] {
      if (!lastCompletion) return [];
      return [...new Set([...lastCompletion.failedGateIds, ...lastCompletion.unverifiedGateIds,
        ...(lastCompletion.requirements ?? []).filter(row => row.status !== 'VERIFIED').map(row => row.id)])];
    }
    function attemptLabel(value: CompletionRecord | undefined): string {
      return value?.taskId && value.runId && value.suite ?
        `task ${value.taskId}; milestone ${value.milestoneId ?? 'unknown'}; suite ${value.suite.id}@${value.suite.version} (${value.suite.digest}); run ${value.runId}` :
        'attempt provenance unavailable';
    }

    function refreshCurrentContext(ctx: ExtensionContext, preserveRepairHistory = false): void {
      if (!dependencies.loadControllerContext || !engine.stage) return;
      let next: ControllerContext | undefined;
      try {
        const supplied = dependencies.loadControllerContext(engine.stage, ctx.cwd);
        if (supplied) next = validateControllerContext(supplied, engine.stage);
      } catch { /* Invalid host state invalidates current evidence below. */ }
      if (JSON.stringify(next) !== JSON.stringify(controllerContext)) {
        const retainPrevious = preserveRepairHistory && !!next && !!controllerContext &&
          next.taskId === controllerContext.taskId && next.stage === controllerContext.stage &&
          next.suite.id === controllerContext.suite.id && next.suite.version === controllerContext.suite.version &&
          next.suite.digest === controllerContext.suite.digest &&
          JSON.stringify(next.originalTask) === JSON.stringify(controllerContext.originalTask);
        if (!retainPrevious) lastReport = undefined;
        lastCompletion = undefined;
        recoveryPlan = undefined;
        if (!retainPrevious) {
          lastRecovery = undefined;
          recoveryKeys.clear();
          recoveryAttempts = 0;
        }
        controllerContext = next;
        if (next) engine.setTask(next.originalTask.text, next.stage);
      }
    }

    function noProgressRetryReady(report: GateReport | undefined): boolean {
      return !!report && lastCompletion?.decision === 'RECOVERY_REQUIRED' && !!recoveryPlan &&
        engine.mode === 'active' && !!lastRecovery && recoveryTurnObserved &&
        lastRecovery.plan.stage === report.stage && lastRecovery.plan.snapshotIdentity === report.snapshotIdentity &&
        report.schemaVersion === 2 && lastCompletion.taskId === report.taskId &&
        lastRecovery.plan.diagnosis.suite?.id === report.suite.id &&
        lastRecovery.plan.diagnosis.suite?.version === report.suite.version &&
        lastRecovery.plan.diagnosis.suite?.digest === report.suite.digest &&
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
        if (lastCompletion?.runId) lines.splice(2, 0, `Task ${lastCompletion.taskId} | milestone ${lastCompletion.milestoneId} | run ${lastCompletion.runId}`);
        lines.splice(2, 0, `${verificationActivity} | ${verificationElapsedMs} ms | recovery ${recoveryAttempts}/${limits.maxRecoveryAttempts}`);
        const unresolved = unresolvedIds();
        if (unresolved.length) lines.splice(3, 0, `Unresolved: ${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? '…' : ''}`);
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

    function refreshTestDiscovery(ctx: ExtensionContext): void {
      testDiscovery = discoverProjectTestCommand(ctx.cwd);
      noTestsMode = testDiscovery.kind === 'none' && !controllerContext &&
        !verifierRequested() && !dependencies.projectDiagnostic;
    }

    function testSetupSummary(): string {
      if (noTestsMode) return 'No test command found in known manifests; no-tests mode (completion UNVERIFIED)';
      if (testDiscovery.kind === 'candidate')
        return `Test command found: ${testDiscovery.command} (${testDiscovery.source}; not run by Pi Sitter)`;
      if (testDiscovery.kind === 'unknown') return `Test setup undetermined: ${testDiscovery.reason}`;
      return 'No project test command found; host verification may still be available';
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
      source?: OutcomeEntry['source'], interventionId?: string): void {
      const diagnosis = outcome.diagnosis;
      pi.appendEntry<OutcomeEntry>(OUTCOME_TYPE, {
        kind, source, interventionId, trigger: trigger.key, issue: diagnosis?.issue, evidence: diagnosis?.evidence,
        nextAction: diagnosis?.next_action, confidence: diagnosis?.confidence,
        reason: outcome.reason, latencyMs: outcome.latencyMs,
        inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens,
        validation: outcome.validation,
      });
    }

    function startIntervention(trigger: Trigger): string {
      const id = randomUUID();
      const event: InterventionEvent = { id, phase: 'started', trigger: trigger.key, stage: engine.stage,
        description: trigger.type === 'T5' ? 'Investigating repeated unchanged inspections…' :
          trigger.type === 'T4' ? 'Investigating repeated ineffective operation…' :
          trigger.type === 'T3' ? 'Investigating saved project state…' :
          trigger.type === 'T2' ? 'Investigating repeated setup calls…' : 'Investigating repeated tool failure…' };
      interventions.apply(event);
      try { pi.appendEntry(INTERVENTION_TYPE, event); } catch { /* Supervision remains advisory if display fails. */ }
      return id;
    }

    function finishIntervention(id: string, trigger: Trigger, phase: InterventionEvent['phase'],
      outcome: InferenceOutcome, source?: OutcomeEntry['source'], delivered = false, workerPrompt?: string): void {
      const event: InterventionEvent = { id, phase, trigger: trigger.key, stage: engine.stage,
        issue: outcome.diagnosis?.issue, evidence: outcome.diagnosis?.evidence,
        nextAction: outcome.diagnosis?.next_action, confidence: outcome.diagnosis?.confidence,
        reason: outcome.reason, source, delivered,
        workerPrompt, rejectedResponses: outcome.rejectedResponses };
      if (interventions.apply(event)) try { pi.appendEntry(INTERVENTION_TYPE, event); }
      catch { /* A transcript write failure must not change Worker control. */ }
    }

    function cancelInterventions(reason: string, persist = true): void {
      for (const started of interventions.active()) {
        const event: InterventionEvent = { ...started, phase: 'cancelled', reason };
        if (interventions.apply(event) && persist) try { pi.appendEntry(INTERVENTION_TYPE, event); }
        catch { /* Session teardown can proceed without a transcript write. */ }
      }
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
      const previousReport = lastReport;
      lastReport = undefined;
      lastCompletion = undefined;
      recoveryPlan = undefined;
      workerState = 'Verifying';
      verificationActivity = 'Inspecting saved project snapshot';
      verificationStartedAt = performance.now();
      render(ctx);
      let attemptContext: ControllerContext | undefined;
      try {
        refreshSelectedPlan(ctx);
        if (configurationError) throw new Error(`Verifier selection blocked: ${configurationError}`);
        const planAtStart = selectedPlanId;
        const suppliedAtStart = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
        if (!suppliedAtStart) throw new Error('Trusted controller task and protected suite are not configured');
        const authoritative = validateControllerContext(suppliedAtStart, engine.stage);
        attemptContext = authoritative;
        const checkpoint = selectCheckpoint(authoritative, request, previousReport);
        const checkpointKey = [checkpoint.taskId, checkpoint.milestoneId, checkpoint.snapshotId,
          authoritative.suite.digest, checkpoint.reason].join(':');
        if (request.reason === 'milestone' && completedCheckpoints.has(checkpointKey)) return {};
        if (request.reason === 'milestone') completedCheckpoints.add(checkpointKey);
        pi.appendEntry(CHECKPOINT_TYPE, checkpoint);
        controllerContext = authoritative;
        engine.setTask(authoritative.originalTask.text, authoritative.stage);
        const preflight = dependencies.verificationSetup?.preflight?.(engine.stage, ctx.cwd, selectedPlanId);
        if (preflight && !preflight.ready)
          throw new Error(`Host verification preflight failed: ${preflight.reason || 'approved plan unavailable'}`);
        const run = dependencies.verify ?? configuredVerifier(selectedPlanId ? JSON.stringify(selectedPlanId) : undefined,
          dependencies.resolveApprovedVerifier);
        if (!run) throw new Error('No verification provider is configured for this project');
        const raw = await run(engine.stage, ctx.cwd, { signal: current.signal, previous: previousReport, ctx,
          checkpoint });
        if (current.signal.aborted || engine.sessionId !== sessionId) return {};
        refreshSelectedPlan(ctx);
        if (configurationError || selectedPlanId !== planAtStart)
          throw new Error('Approved verifier selection changed during verification');
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
        const report = normalizeGateReport(input, selectedContext, previousReport);
        if (seenRunIds.has(report.runId)) throw new Error('Duplicate verification run identity');
        report.checkpoint = { ...checkpoint, runId: report.runId };
        let review: RequirementReview | undefined;
        if (dependencies.reviewRequirements) {
          if (!dependencies.evidenceBroker) throw new Error('Independent source inspection broker is unavailable');
          const snapshot = await dependencies.evidenceBroker(ctx.cwd).openSnapshot(current.signal,
            { taskId: report.taskId, turnId: report.runId });
          try {
            if (snapshot.identity !== report.snapshotIdentity) throw new Error('Requirement review source snapshot is stale');
            const issued = new Map<string, string>();
            const reviewSnapshot: Pick<EvidenceSnapshot, 'identity' | 'inspect'> = { identity: snapshot.identity,
              inspect: async (requests, signal) => {
              const results = await snapshot.inspect(requests, signal);
              for (const result of results) if (result.ok && result.receipt?.status === 'allowed')
                issued.set(JSON.stringify(result.receipt), typeof result.evidence === 'string' ? result.evidence : JSON.stringify(result.evidence));
              return results;
            } };
            const reviewed = await withAbort(dependencies.reviewRequirements(structuredClone(authoritative), structuredClone(report), reviewSnapshot,
              current.signal), current.signal);
            if (current.signal.aborted || engine.sessionId !== sessionId) return {};
            review = validateRequirementReview(reviewed, authoritative, report);
            if (review.findings.some(row => row.evidence.some(item =>
                !issued.get(JSON.stringify(item.receipt))?.includes(item.quote))))
              throw new Error('Requirement review cited a quote absent from current issued inspection evidence');
          } finally { await snapshot.close(); }
          const suppliedAfterReview = dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
          if (!suppliedAfterReview || JSON.stringify(validateControllerContext(suppliedAfterReview, engine.stage)) !==
              JSON.stringify(currentContext)) throw new Error('Trusted task, source, or suite changed during requirement review');
        }
        seenRunIds.add(report.runId);
        pi.appendEntry(VERIFICATION_TYPE, report);
        lastReport = report;
        const decision = decideCompletion(report, undefined, authoritative, review);
        if (emptyFinalTerminalIssued && decision.decision === 'VERIFIED') {
          decision.decision = 'UNVERIFIED';
          decision.reason = 'Worker stopped without a final report after one continuation; completion remains unconfirmed';
        }
        verificationElapsedMs = Math.round(performance.now() - verificationStartedAt);
        const completion: CompletionRecord = { stage: report.stage, task: authoritative.originalTask.text, runId: report.runId,
          decision: decision.decision,
          snapshotIdentity: report.snapshotIdentity, counts: report.counts,
          failedGateIds: report.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
          unverifiedGateIds: report.gates.filter(gate => gate.result === 'UNVERIFIED').map(gate => gate.id),
          regressions: report.regressions, attempt: recoveryAttempts, elapsedMs: verificationElapsedMs,
          reason: decision.reason, taskId: report.taskId, milestoneId: checkpoint.milestoneId,
          suite: report.suite, requirements: review?.findings ?? authoritative.originalTask.requirements.map(req => ({
            id: req.id, status: 'UNVERIFIED' as const, reason: 'Independent source review unavailable', evidence: [],
            limitations: ['No host-approved requirement inspection was configured'] })) };
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
            attempt: recoveryAttempts, elapsedMs: verificationElapsedMs, reason,
            taskId: attemptContext?.taskId, milestoneId: request.milestoneId,
            attemptSourceSnapshot: attemptContext?.sourceSnapshot,
            suite: attemptContext?.suite && { id: attemptContext.suite.id,
              version: attemptContext.suite.version, digest: attemptContext.suite.digest } };
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

    async function diagnose(trigger: Trigger, ctx: ExtensionContext, interventionId?: string): Promise<{ outcome: InferenceOutcome; modeAtStart: PiSitterMode; stale: boolean }> {
      const modeAtStart = engine.mode;
      const sessionAtStart = engine.sessionId;
      if (modeAtStart === 'off' || remaining() === 0 || controller) return { outcome: { kind: 'canceled', latencyMs: 0, reason: 'supervision disabled, busy, or budget exhausted' }, modeAtStart, stale: false };
      controller = new AbortController();
      const current = controller;
      const input = { task: engine.task, stage: engine.stage, trigger, recent: engine.recent,
        workerTools: pi.getActiveTools() };
      let outcome: InferenceOutcome = { kind: 'failed', latencyMs: 0, reason: 'No inference attempted' };
      const rejectedResponses: string[] = [];
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
          if (outcome.invalidOutput && outcome.rawResponse) rejectedResponses.push(outcome.rawResponse);
          totalLatencyMs += outcome.latencyMs;
          inputTokens += outcome.inputTokens ?? 0;
          outputTokens += outcome.outputTokens ?? 0;
          if (outcome.kind === 'ready') validDiagnoses++;
          if (outcome.kind === 'abstained') abstained++;
          if (outcome.kind === 'failed' || outcome.kind === 'timeout') failed++;
          if (outcome.invalidOutput && attempt === 0 && remaining() > 0) {
            lastRejectedReason = outcome.reason?.slice(0, 140) ?? 'invalid output';
            recordOutcome(trigger, outcome, outcome.kind, undefined, interventionId);
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
      if (rejectedResponses.length) outcome = { ...outcome, rejectedResponses };
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
    pi.registerEntryRenderer<{ signature: string; text: string }>(STARTUP_TYPE, (entry, _options, theme) => {
      const value = entry.data;
      if (!value?.text) return;
      return { render(width: number) {
        if (width <= 0) return [];
        const chars = Array.from(value.text);
        const lines: string[] = [];
        for (let offset = 0; offset < chars.length; offset += width)
          lines.push(theme.fg('muted', chars.slice(offset, offset + width).join('')));
        return lines;
      }, invalidate() {} };
    });
    pi.registerEntryRenderer<VerificationReadiness & { signature: string; stage: string }>(READINESS_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value?.signature) return;
      return { render(width: number) {
        const current = value.signature === readinessSignature;
        const notice = value.candidate ? testCommandNotice(value) : undefined;
        return supervisorCard(theme, { stage: value.stage,
          status: current ? notice?.status ?? value.status : 'HISTORICAL',
          summary: current ? notice?.summary ?? value.summary : 'Historical setup status; current host configuration must be checked again',
          details: current && expanded ? [
            `Final validation: ${value.status === 'READY' ? 'ready' : value.status === 'CONFIGURED' ? 'host preflight pending' : 'unavailable'}`,
            ...value.missing.map(item => `Missing: ${item}`)] : [],
          tone: current && notice?.warning ? 'failure' : current ? 'normal' : 'pending',
        }, width);
      }, invalidate() {} };
    });
    function diagnosticCard(getState: () => ProjectDiagnosticCard | 'interrupted' | undefined,
      stage: string, isRunning: () => boolean, expanded: boolean, theme: Theme) {
      let detailMode: 'closed' | 'formatted' | 'raw' = expanded ? 'formatted' : 'closed';
      let detailOffset = 0;
      let technicalLength = 0;
      return { render(width: number) {
        const result = getState();
        if (!result || result === 'interrupted') return supervisorCard(theme, { stage,
          status: isRunning() ? 'ANALYZING' : 'INTERRUPTED',
          summary: isRunning() ? 'Checking the saved project…' : 'Diagnostic ended before a result was returned',
          tone: isRunning() ? 'pending' : 'failure',
        }, width);
        const finding = result.failures?.[0] ? diagnosticFinding(result.failures[0]) : undefined;
        const prompt = result.workerPrompt ?? result.previousWorkerPrompt;
        const final = result.followup;
        const status = result.followupPending ? 'CHECKING REPAIR' : final?.status === 'PASS' ?
          'RESOLVED BY HOST DIAGNOSTIC' : final?.status === 'FAIL' ? 'STILL FAILING' :
          final?.status === 'BLOCKED' ? 'OUTCOME UNKNOWN' : result.status === 'PASS' ?
          'DIAGNOSTIC PASS' : result.status === 'BLOCKED' ? 'DIAGNOSTIC BLOCKED' :
          result.workerPrompt ? result.guidanceDeliveryFailed ? 'INTERVENTION FAILED' :
            result.guidanceReceived ? 'GUIDANCE RECEIVED — REPAIR NOT YET VERIFIED' :
            'GUIDANCE SUPPLIED — DELIVERY PENDING' : 'DIAGNOSIS READY';
        const current = final ?? result;
        const progress = current.total ? `${current.passed}/${current.total} passed` : 'Verification unavailable';
        const bar = current.total ? `${'■'.repeat(Math.min(10, Math.round(10 * current.passed / current.total)))}${'·'.repeat(10 - Math.min(10, Math.round(10 * current.passed / current.total)))}` : '';
        const technical = [
          `Diagnostic source: ${result.suite ?? 'host project diagnostic'}; stage ${result.stage}`,
          `Initial status: ${result.status}; ${result.passed}/${result.total} passed; ${result.failed} failed`,
          ...((result.rawResult?.failures ?? result.failures ?? []).flatMap(row => [`${row.id}:`, ...
            (detailMode === 'raw' ? safeRawLines(row.detail) : readableMarkdown(row.detail)),
            ...(row.path ? [`Path: ${row.path}`] : []),
            ...(row.expected !== undefined && row.observed !== undefined ?
              [`Expected: ${row.expected}`, `Observed: ${row.observed}`] : [])])),
          ...((result.rawResult?.reason ?? result.reason) ? [`Host reason: ${result.rawResult?.reason ?? result.reason}`] : []),
          ...(prompt ? [result.workerPrompt ? 'Full prompt supplied to Worker after this diagnostic:' :
            'Full prompt supplied to Worker after the previous diagnostic (none sent after this result):',
            ...(detailMode === 'raw' ? safeRawLines(prompt) : readableMarkdown(prompt))] : []),
          ...(final ? [`Follow-up diagnostic: ${final.status}; ${final.passed}/${final.total} passed; ${final.failed} failed`,
            ...(result.rawFollowup?.failures ?? final.failures ?? []).flatMap(row => [`${row.id}: ${row.detail}`]),
            ...((result.rawFollowup?.reason ?? final.reason) ? [`Follow-up reason: ${result.rawFollowup?.reason ?? final.reason}`] : [])] : []),
          ...(result.workerPrompt ? [`Worker activity: ${final ? 'continued' : 'awaiting follow-up'}; saved progress: ${result.workerProgressObserved ? 'observed' : 'not observed'}`] : []),
        ];
        technicalLength = technical.length;
        const visible = technical.slice(detailOffset, detailOffset + 32);
        const heading = finding?.title ?? (result.status === 'BLOCKED' ? 'Host diagnostic unavailable' :
          result.status === 'PASS' ? 'Saved project checks passed' : 'Host diagnostic failed');
        return supervisorCard(theme, { stage: result.stage,
          status,
          summary: `${progress}${bar ? `  ${bar}` : ''}\n${heading}`,
          details: [
            ...(finding ? [`${finding.id}${finding.path ? `  ${finding.path}` : ''}`,
              finding.explanation,
              ...(finding.expected !== undefined && finding.observed !== undefined ?
                [`Expected: ${finding.expected}`, `Observed: ${finding.observed}`] : [])] :
              result.reason ? [result.reason] : []),
            ...(result.workerPrompt ? ['Recommended repair: inspect the reported saved-state mismatch, make a supported in-place repair, then read it back.'] : []),
            ...(result.workerPrompt ? [`Guidance ${result.guidanceReceived ? 'received by' : 'supplied to'} Worker; ${final ?
              result.workerProgressObserved ? 'saved progress observed' : 'Worker continued; saved progress not observed' :
              'repair not yet verified'}.`] : []),
            ...(detailMode !== 'closed' ? ['Technical details and worker instructions', ...visible,
              ...(technical.length > detailOffset + 32 ? [`${technical.length - detailOffset - 32} more lines; scroll down for next page`] : [])] : []),
          ],
          hint: `Technical details and worker instructions — ${detailMode === 'closed' ? 'click to expand' :
            detailMode === 'formatted' ? 'formatted; click for raw source' : 'raw source; click to collapse'}`,
          tone: result.followupPending ? 'pending' : final?.status === 'PASS' || result.status === 'PASS' ? 'normal' :
            status === 'OUTCOME UNKNOWN' || status === 'DIAGNOSIS READY' || status.startsWith('GUIDANCE') ? 'recovery' : 'failure',
        }, width);
      }, invalidate() {}, handleMouse(event: { type: string; button?: string; wheelDelta?: number }) {
        const result = getState();
        if (!result || result === 'interrupted') return;
        if (event.type === 'wheel' && detailMode !== 'closed') {
          detailOffset = Math.max(0, Math.min(Math.max(0, technicalLength - 32),
            detailOffset + (event.wheelDelta ?? 0)));
          return { handled: true };
        }
        if (event.type !== 'click' || event.button !== 'left') return;
        detailMode = detailMode === 'closed' ? 'formatted' : detailMode === 'formatted' ? 'raw' : 'closed';
        detailOffset = 0;
        return { handled: true };
      } };
    }
    pi.registerEntryRenderer<{ id: string; stage: string }>(PROJECT_DIAGNOSTIC_PENDING_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value?.id) return;
      return diagnosticCard(() => diagnosticCards.get(value.id), value.stage,
        () => pendingDiagnosticId === value.id, expanded, theme);
    });
    pi.registerEntryRenderer<ProjectDiagnosticCard>(PROJECT_DIAGNOSTIC_TYPE, (entry, { expanded }, theme) => {
      const value = entry.data;
      if (!value || (value.displayId && diagnosticCards.has(value.displayId))) return;
      return diagnosticCard(() => value, value.stage, () => false, expanded, theme);
    });
    pi.registerEntryRenderer<OutcomeEntry>(OUTCOME_TYPE, (entry, { expanded }, theme) => {
      const data = entry.data;
      if (!data) return;
      if (data.interventionId && interventions.hasStart(data.interventionId)) return;
      return { render(width: number) { return (expanded || data.kind === 'delivered' || data.kind === 'delivery_failed' || data.kind === 'failed' || data.kind === 'timeout') ?
        supervisorCard(theme, {
          status: data.kind.toUpperCase(),
          summary: `${data.source === 'fallback' ? 'Fallback: ' : ''}${data.issue ?? data.reason ?? 'No advisory'}`,
          details: expanded && data.nextAction ? [`Evidence: ${data.evidence ?? '(none)'}`, `Next: ${data.nextAction}`] : [],
          tone: data.kind === 'delivery_failed' || data.kind === 'failed' || data.kind === 'timeout' ? 'failure' : 'normal',
        }, width) : []; }, invalidate() {} };
    });
    pi.registerEntryRenderer<InterventionEvent>(INTERVENTION_TYPE, (entry, { expanded }, theme) => {
      const saved = entry.data;
      if (!saved?.id) return;
      if (saved.phase !== 'started' && interventions.hasStart(saved.id)) return;
      if (saved.phase !== 'started' && interventions.get(saved.id) !== saved) return;
      let open = expanded;
      return { render(width: number) {
        const state = interventions.get(saved.id) ?? saved;
        const pending = state.phase === 'started';
        const hasMore = !!state.workerPrompt || !!state.rejectedResponses?.length;
        const summary = pending ? `${state.description ?? 'Investigating trigger…'} ◌` :
          state.phase === 'failed' || state.phase === 'cancelled' ?
            state.reason ?? state.issue ?? 'Supervision ended without a result' :
            open && state.workerPrompt ? 'Worker directive (expanded below)' :
              state.workerPrompt?.split('\n')[1] ?? state.nextAction ?? state.issue ?? state.reason ?? 'No diagnosis returned';
        return supervisorCard(theme, { stage: state.stage,
          status: pending ? 'ANALYZING' : state.phase === 'completed' ?
            state.delivered ? failedInterventions.has(state.id) ? 'INTERVENTION FAILED' :
              actedInterventions.has(state.id) ? 'WORKER ACTED — REPAIR UNVERIFIED' :
              receivedInterventions.has(state.id) ? 'GUIDANCE RECEIVED — REPAIR UNVERIFIED' :
              'GUIDANCE SUPPLIED — DELIVERY PENDING' : 'DIAGNOSIS READY' : state.phase.toUpperCase(),
          summary,
          details: !pending ? [
            !open && state.workerPrompt?.split('\n').find(line => line.startsWith('Next: ')),
            ...(open && state.workerPrompt ? ['Full prompt supplied to Worker:', ...readableMarkdown(state.workerPrompt)] : []),
            open && state.issue && `Issue: ${state.issue}`,
            open && state.evidence && `Evidence: ${state.evidence}`,
            open && state.confidence !== undefined && `Confidence: ${state.confidence.toFixed(2)}`,
            open && state.nextAction && !state.workerPrompt?.includes(`Next: ${state.nextAction}`) &&
              `Diagnostic suggestion (not sent verbatim): ${state.nextAction}`,
            open && `Trigger: ${state.trigger.split(':')[0]}`,
            open && state.reason && `Outcome: ${state.reason}`,
            ...(open ? (state.rejectedResponses ?? []).flatMap((response, index) =>
              [`Rejected supervisor response ${index + 1} (not sent to Worker):`, ...readableMarkdown(response)]) : [])]
            .filter((value): value is string => !!value) : [],
          hint: hasMore ? `Click to show ${open ? 'less' : 'more'}` : undefined,
          tone: pending || state.phase === 'cancelled' ? 'pending' :
            state.phase === 'failed' || failedInterventions.has(state.id) ? 'failure' :
            state.delivered ? 'recovery' : 'normal',
        }, width);
      }, invalidate() {}, handleMouse(event) {
        const state = interventions.get(saved.id) ?? saved;
        if (event.type !== 'click' || event.button !== 'left' || (!state.workerPrompt && !state.rejectedResponses?.length)) return;
        open = !open;
        return { handled: true };
      } };
    });
    pi.registerMessageRenderer(ADVISORY_TYPE, (message, _options, theme) => ({
      render(width: number) {
        const lines = (typeof message.content === 'string' ? message.content : '').split('\n');
        if (lines[0]?.startsWith('[Pi Sitter guidance') || lines[0]?.startsWith('[Pi Sitter intervention')) lines.shift();
        return supervisorCard(theme, { status: 'GUIDANCE', summary: lines.shift() ?? 'Supervisor guidance', details: lines }, width);
      }, invalidate() {},
    }));
    pi.registerEntryRenderer<GateReport>(VERIFICATION_TYPE, (entry, { expanded }, theme) => {
      const report = entry.data;
      if (!report) return;
      const current = report.schemaVersion === 2 && sameAttempt(report, lastCompletion) && lastReport?.schemaVersion === 2 &&
        lastReport.runId === report.runId && controllerContext?.taskId === report.taskId &&
        controllerContext?.sourceSnapshot === report.snapshotIdentity && controllerContext?.suite.id === report.suite.id &&
        controllerContext?.suite.version === report.suite.version && controllerContext?.suite.digest === report.suite.digest;
      const status = current ? lastCompletion!.decision : 'HISTORICAL';
      const summary = current ? lastCompletion!.reason : 'Historical report; current attempt requires fresh validated evidence';
      return { render(width: number) { return expanded ? supervisorCard(theme, {
        stage: report.stage, status, summary,
        details: [...report.gates.filter(gate => gate.result !== 'PASS').slice(0, 20).map(gate =>
          `${gate.id}: ${gate.result}. ${gate.evidence || gate.explanation}`),
          `${report.regressions.length} regressions`, `Snapshot ${report.snapshotIdentity.slice(0, 12)}`],
        tone: status === 'VERIFIED' ? 'normal' : status === 'RECOVERY_REQUIRED' ? 'recovery' : 'failure',
      }, width) : []; }, invalidate() {} };
    });
    function renderCompletionCard(value: CompletionRecord, expanded: boolean, theme: Theme, width: number): string[] {
      const current = value === lastCompletion || (sameAttempt(lastReport, value) && sameAttempt(lastReport, lastCompletion));
      const historical = !current;
      const summary = historical ? 'Historical completion; current attempt requires fresh validated evidence' :
        value.decision === 'RECOVERY_REQUIRED' ?
          `${value.counts.FAIL} failed: ${value.failedGateIds.join(', ') || value.reason}` :
          value.decision === 'UNVERIFIED' ?
            `${value.counts.UNVERIFIED} unverified: ${value.unverifiedGateIds.join(', ') || value.reason}` : value.reason;
      const tone: CardTone = value.decision === 'VERIFIED' ? 'normal' :
        value.decision === 'RECOVERY_REQUIRED' && value.attempt < limits.maxRecoveryAttempts ? 'recovery' : 'failure';
      return supervisorCard(theme, {
        stage: value.stage,
        status: historical ? 'HISTORICAL' : value.decision === 'RECOVERY_REQUIRED' && tone === 'failure' ? 'FAILED' : value.decision,
        summary, details: expanded ? [value.reason, ...(value.requirements ?? []).map(row =>
          `${row.id} ${row.status}: ${row.reason}${row.evidence.length ? ` (${row.evidence.map(item => `${item.path}:${item.line}`).join(', ')})` : ''}`)] : [], tone,
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
      return { render(width: number) { const current = currentRecovery() && value.plan.diagnosis?.run === lastCompletion?.runId;
        return expanded ? supervisorCard(theme, {
        stage: value.plan.stage, status: current ? 'RECOVERY_QUEUED' : 'HISTORICAL',
        summary: current ? `Attempt ${value.attempt} of ${limits.maxRecoveryAttempts}${value.retry ? `, retry ${value.retry}` : ''} for ${value.plan.focusGateIds.join(', ')}` :
          'Historical recovery; no current repair is authorized by this entry',
        details: [`Delivery: ${value.delivery}`, ...details], tone: current ? 'recovery' : 'failure',
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
        const current = currentRecovery() && state.plan.diagnosis?.run === lastCompletion?.runId;
        return supervisorCard(theme, { stage: value.stage, status: current ? 'RECOVERY_QUEUED' : 'HISTORICAL',
          summary: current ? `Attempt ${state.attempt} of ${limits.maxRecoveryAttempts} for ${state.plan.focusGateIds.join(', ')}` :
            'Historical recovery; no current repair is authorized by this entry',
          details: expanded ? [`Delivery: ${state.delivery}`, ...state.plan.text.split('\n')] : [], tone: current ? 'recovery' : 'failure',
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
    pi.registerEntryRenderer<EmptyFinalEntry>(EMPTY_FINAL_TYPE, (entry, _options, theme) => {
      const value = entry.data;
      if (value?.phase !== 'stopped') return;
      return { render(width: number) { return supervisorCard(theme, { stage: value.stage,
        status: 'UNVERIFIED', summary: 'Worker stopped without a final report after one continuation. Required checks and completion remain unconfirmed.',
        tone: 'failure',
      }, width); }, invalidate() {} };
    });
    pi.registerMessageRenderer(EMPTY_FINAL_MESSAGE_TYPE, () => ({
      render() { return []; }, invalidate() {},
    }));

    pi.on('session_start', (_event, ctx) => {
      try {
        cancelInterventions('Session changed during supervision', false);
        controller?.abort(new Error('Pi Sitter session changed'));
        verificationController?.abort(new Error('Pi Sitter session changed'));
        analysisController?.abort(new Error('Pi Sitter session changed'));
        projectDiagnosticController?.abort(new Error('Pi Sitter session changed'));
        stopUI();
        engine.reset(initialMode());
        view.reset();
        pendingArgs.clear();
        terminating.clear();
        adviceKeys.clear();
        interventions.clear();
        receivedInterventions.clear(); failedInterventions.clear(); actedInterventions.clear();
        contextInterventionIds.clear(); lastAdviceInterventionId = undefined;
        workerToolNames.length = 0;
        pending = undefined;
        controller = undefined;
        verificationController = undefined;
        analysisController = undefined;
        projectDiagnosticController = undefined;
        lastReport = undefined;
        controllerContext = undefined;
        lastCompletion = undefined;
        verificationCards.clear();
        pendingVerificationId = undefined;
        diagnosticCards.clear();
        activeDiagnosticId = undefined;
        pendingDiagnosticId = undefined;
        recoveryCards.clear();
        recoveryPlan = undefined;
        recoveryAttempts = 0;
        verificationRuns = 0;
        completedCheckpoints.clear();
        seenRunIds.clear();
        recoveryKeys.clear();
        lastRecovery = undefined;
        recoveryTurnObserved = false;
        emptyFinalContinuationIssued = false;
        emptyFinalTerminalIssued = false;
        unavailableAtCompletionIssued = false;
        projectDiagnosticRetryIssued = false;
        lastProjectDiagnosticPrompt = undefined;
        lastDiagnostic = undefined;
        selectedPlanId = undefined;
        readinessState = undefined;
        readinessSignature = '';
        configurationError = undefined;
        controllerConfigurationError = undefined;
        handledEmptyFinalMessages.clear();
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
        lastAdviceInspectionReceipt = undefined;
        lastObservedResultFingerprint = undefined;
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
          if (entry.customType === EMPTY_FINAL_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as EmptyFinalEntry;
            if (saved.stage === stage && typeof saved.messageEntryId === 'string') {
              handledEmptyFinalMessages.add(saved.messageEntryId);
              if (saved.phase === 'continuing') emptyFinalContinuationIssued = true;
              if (saved.phase === 'stopped') emptyFinalTerminalIssued = true;
            }
          }
          if (entry.customType === PROJECT_DIAGNOSTIC_RETRY_TYPE && entry.data && typeof entry.data === 'object' &&
              (entry.data as { stage?: string }).stage === stage) projectDiagnosticRetryIssued = true;
          if (entry.customType === PROJECT_DIAGNOSTIC_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as ProjectDiagnosticCard;
            if (saved.stage === stage && saved.displayId) {
              diagnosticCards.set(saved.displayId, saved);
              activeDiagnosticId = saved.displayId;
            }
            if (saved.stage === stage && saved.workerPrompt) lastProjectDiagnosticPrompt = saved.workerPrompt;
            if (saved.stage === stage) {
              const latest = saved.followup ?? saved;
              lastDiagnostic = latest.status === 'FAIL' ? { stage,
                failed: latest.failed, total: latest.total, failures: latest.failures ?? [],
                progressVersion: saved.followup ? saved.followupProgressVersion ?? -1 : saved.progressVersion ?? -1 } : undefined;
            }
          }
          if (entry.customType === INTERVENTION_TYPE && entry.data && typeof entry.data === 'object')
            interventions.apply(entry.data as InterventionEvent);
          if (entry.customType === EVENT_TYPE && entry.data && typeof entry.data === 'object') engine.restoreTrigger(entry.data as Trigger);
          if (entry.customType === CALL_TYPE) calls++;
          if (entry.customType === DELIVERY_CONFIRM_TYPE) {
            confirmedDeliveries++;
            const id = (entry.data as { interventionId?: string } | undefined)?.interventionId;
            if (id) receivedInterventions.add(id);
          }
          if (entry.customType === DELIVERY_FAILURE_TYPE) {
            failedDeliveries++;
            for (const id of (entry.data as { interventionIds?: string[] } | undefined)?.interventionIds ?? []) failedInterventions.add(id);
          }
          if (entry.customType === WORKER_RECOVERY_TYPE) {
            workerRecoveries++;
            const id = (entry.data as { interventionId?: string } | undefined)?.interventionId;
            if (id) actedInterventions.add(id);
          }
          if (entry.customType === ANALYSIS_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as AnalysisOutcome;
            completionDiagnosisCalls += Math.min(1, saved.calls ?? 0);
            recoveryGenerationCalls += Math.max(0, (saved.calls ?? 0) - 1);
          }
          if (entry.customType === VERIFICATION_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as GateReport;
            if (saved.schemaVersion === 2 && saved.runId) seenRunIds.add(saved.runId);
            if (saved.stage === stage) lastReport = saved;
          }
          if (entry.customType === VERIFICATION_PENDING_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as { id?: string; stage?: string; unavailable?: string };
            if (saved.stage === stage && (saved.unavailable?.startsWith('Final test result unavailable:') ||
              saved.unavailable?.startsWith('Protected final verification unavailable:')))
              unavailableAtCompletionIssued = true;
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
              (entry.data as { stage?: string }).stage === stage) {
            verificationRuns++;
            lastReport = undefined;
            lastCompletion = undefined;
            recoveryPlan = undefined;
            lastRecovery = undefined;
            recoveryKeys.clear();
          }
          if (entry.customType === COMPLETION_TYPE && entry.data && typeof entry.data === 'object' && (entry.data as CompletionRecord).stage === stage) {
            lastCompletion = entry.data as CompletionRecord;
            if (lastCompletion.displayId && verificationCards.has(lastCompletion.displayId))
              verificationCards.set(lastCompletion.displayId, lastCompletion);
          }
          if (entry.customType === RECOVERY_TYPE && entry.data && typeof entry.data === 'object') {
            const saved = entry.data as RecoveryEntry;
            if (saved.plan?.stage === stage && saved.delivery !== 'blocked' &&
                saved.plan.diagnosis?.run && saved.plan.diagnosis.run === lastCompletion?.runId &&
                saved.plan.diagnosis.suite?.digest === lastCompletion?.suite?.digest) {
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
        interventions.interruptPending('Supervision ended before a result was recorded');
        for (const [id, state] of diagnosticCards) {
          if (state && state !== 'interrupted' && state.followupPending)
            diagnosticCards.set(id, { ...state, followupPending: false,
              followup: { status: 'BLOCKED', passed: 0, failed: 0, total: 0,
                reason: 'Follow-up diagnostic interrupted before a result was recorded' } });
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
            lastReport.snapshotIdentity !== controllerContext.sourceSnapshot ||
            !sameAttempt(lastReport, lastCompletion)) {
          lastReport = undefined;
          recoveryPlan = undefined;
          if (lastCompletion?.decision !== 'BLOCKED' || lastCompletion.taskId !== controllerContext?.taskId ||
              lastCompletion.attemptSourceSnapshot !== controllerContext?.sourceSnapshot ||
              lastCompletion.suite?.id !== controllerContext?.suite.id ||
              lastCompletion.suite?.version !== controllerContext?.suite.version ||
              lastCompletion.suite?.digest !== controllerContext?.suite.digest)
            lastCompletion = undefined;
        } else {
          try {
            const savedCheckpoint = lastReport.checkpoint;
            lastReport = normalizeGateReport({ schemaVersion: 2, taskId: lastReport.taskId, runId: lastReport.runId, stage: lastReport.stage,
              snapshotIdentity: lastReport.snapshotIdentity, suite: lastReport.suite,
              testCounts: lastReport.testCounts, execution: { exitCode: lastReport.testCounts.failed > 0 ? 1 : 0 },
              gates: lastReport.gates.map(gate => ({ id: gate.id, tests: gate.tests })) },
              checkpointContext(controllerContext, savedCheckpoint!));
            lastReport.checkpoint = savedCheckpoint;
            if (lastCompletion) {
              let review: RequirementReview | undefined;
              if (lastCompletion.requirements && savedCheckpoint) {
                review = validateRequirementReview({ taskId: lastCompletion.taskId, stage,
                  milestoneId: lastCompletion.milestoneId, sourceSnapshot: lastCompletion.snapshotIdentity,
                  suite: lastCompletion.suite, runId: lastCompletion.runId, findings: lastCompletion.requirements },
                  controllerContext, lastReport);
              }
              const decision = decideCompletion(lastReport, undefined, controllerContext, review);
              if (emptyFinalTerminalIssued && decision.decision === 'VERIFIED') {
                decision.decision = 'UNVERIFIED';
                decision.reason = 'Worker stopped without a final report after one continuation; completion remains unconfirmed';
              }
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
        if (lastReport && lastCompletion?.decision === 'RECOVERY_REQUIRED' && sameAttempt(lastReport, lastCompletion))
          recoveryPlan = (dependencies.recoveryPlan ?? createRecoveryPlan)(lastReport, lastCompletion.task);
        engine.sessionId = ctx.sessionManager.getSessionId();
        refreshSelectedPlan(ctx);
        refreshTestDiscovery(ctx);
        lastStatus = lastWidget = '';
        render(ctx);
      } catch (error) {
        controllerContext = undefined;
        lastReport = undefined;
        lastCompletion = undefined;
        recoveryPlan = undefined;
        controllerConfigurationError = error instanceof Error ? error.message : 'Host setup could not be read';
        configurationError = controllerConfigurationError;
        // Setup failures remain available through status and the final verification record.
      }
    });

    pi.on('before_agent_start', (event, ctx) => {
      try {
        if (event.messageType === 'user') {
          startUserCompletionCycle();
          const supplied = ctx && dependencies.loadControllerContext?.(engine.stage, ctx.cwd);
          if (supplied) {
            const next = validateControllerContext(supplied, engine.stage);
            if (JSON.stringify(controllerContext) !== JSON.stringify(next)) {
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
          refreshCurrentContext(ctx);
          if (controllerContext) controllerConfigurationError = undefined;
          refreshReadiness(ctx);
        }
        if (event.messageType === 'custom') workerState = 'Recovering';
      } catch (error) {
        if (event.messageType === 'user' && dependencies.loadControllerContext) {
          controllerContext = undefined;
          lastReport = undefined;
          lastCompletion = undefined;
          recoveryPlan = undefined;
          controllerConfigurationError = error instanceof Error ? error.message : 'Host controller could not be read';
          try { refreshReadiness(ctx); } catch { /* The Worker remains unverified. */ }
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
        lastObservedResultFingerprint = resultFingerprint(event.result);
        if (lastAdviceEpoch !== undefined && classification.kind === 'PROGRESS' &&
            event.toolName === lastAdviceTool && engine.progressVersion > lastAdviceEpoch) {
          workerRecoveries++;
          if (lastAdviceInterventionId) actedInterventions.add(lastAdviceInterventionId);
          try { pi.appendEntry(WORKER_RECOVERY_TYPE, { tool: event.toolName, progressVersion: engine.progressVersion,
            interventionId: lastAdviceInterventionId }); }
          catch { /* Observation is best effort. */ }
          lastAdviceEpoch = undefined;
          lastAdviceTool = undefined;
          lastAdviceOperation = undefined;
          lastAdviceInspectionReceipt = undefined;
          repeatedAfterAdvice = 0;
          view.finish('ready', 'Worker recovery observed: saved change');
          render(ctx);
        } else if (lastAdviceEpoch !== undefined && args?.signature === lastAdviceOperation &&
            (classification.kind === 'NO_CHANGE' || classification.kind === 'ERROR' ||
              (classification.kind === 'INSPECTION' && lastAdviceInspectionReceipt !== undefined &&
                resultFingerprint(event.result) === lastAdviceInspectionReceipt))) {
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
        if (message.role === 'custom' && message.customType === PROJECT_DIAGNOSTIC_RETRY_TYPE &&
            typeof message.content === 'string' && activeDiagnosticId) {
          const card = diagnosticCards.get(activeDiagnosticId);
          if (card && card !== 'interrupted' && card.workerPrompt === message.content && !card.guidanceReceived) {
            diagnosticCards.set(activeDiagnosticId, { ...card, guidanceReceived: true });
            try { pi.appendEntry(PROJECT_DIAGNOSTIC_TYPE, { ...card, guidanceReceived: true }); }
            catch { /* Receipt is best effort. */ }
          }
        }
        if (message.role !== 'custom' || message.customType !== ADVISORY_TYPE ||
            typeof message.content !== 'string' || !awaitingContext.has(message.content)) continue;
        awaitingContext.delete(message.content);
        const interventionId = contextInterventionIds.get(message.content);
        contextInterventionIds.delete(message.content);
        if (interventionId) receivedInterventions.add(interventionId);
        confirmedDeliveries++;
        try { pi.appendEntry(DELIVERY_CONFIRM_TYPE, { stage: engine.stage, confirmed: true, interventionId }); }
        catch { /* Context confirmation remains best effort. */ }
      }
    });

    pi.on('agent_settled', (_event, ctx) => {
      if (!awaitingContext.size) return;
      failedDeliveries += awaitingContext.size;
      const interventionIds = [...awaitingContext].map(content => contextInterventionIds.get(content)).filter((id): id is string => !!id);
      for (const id of interventionIds) failedInterventions.add(id);
      try { pi.appendEntry(DELIVERY_FAILURE_TYPE, { stage: engine.stage, count: awaitingContext.size, interventionIds }); }
      catch { /* Failure remains visible in status. */ }
      awaitingContext.clear();
      contextInterventionIds.clear();
      view.finish('error', 'Advisory was committed but no following model context was observed');
      render(ctx);
    });

    pi.on('turn_end', async (event, ctx) => {
      if (lastRecovery && event.message.role === 'assistant') recoveryTurnObserved = true;
      if (!pending) return;
      const trigger = pending;
      pending = undefined;
      if (event.outcome !== 'completed' || engine.mode === 'off') return;
      const interventionId = startIntervention(trigger);
      const interventionSessionId = engine.sessionId;
      if (ctx.hasUI) try { ctx.ui.setWorkingMessage('Pi Sitter investigating…'); }
      catch { /* The transcript event remains authoritative. */ }
      try {
        const safeContinuation = event.message.role === 'assistant' && event.message.stopReason === 'toolUse' && event.toolResults.length > 0 &&
          !event.toolResults.every(result => terminating.has(result.toolCallId));
        const diagnosed = remaining() > 0 ? await diagnose(trigger, ctx, interventionId) : undefined;
        if (diagnosed?.stale) return;
        terminating.clear();
        const modelOutcome = diagnosed?.outcome;
        let outcome: InferenceOutcome = modelOutcome ?? { kind: 'failed', latencyMs: 0, reason: 'Inference budget exhausted' };
        let source: OutcomeEntry['source'] = 'model';
        if (outcome.kind === 'ready' && outcome.diagnosis && (trigger.type === 'T4' || trigger.type === 'T5')) {
          const weak = weakLoopAction(trigger, outcome.diagnosis, engine.recent, engine.task, lastDiagnostic);
          if (weak) {
            lastRejectedReason = weak;
            outcome = { ...outcome, kind: 'failed', reason: weak,
              rejectedResponses: [...(outcome.rejectedResponses ?? []), JSON.stringify(outcome.diagnosis).slice(0, 1000)] };
          }
        }
        if (outcome.kind !== 'ready' || modelAdvisories >= limits.maxValidAdvisories) {
          if (fallbackAdvisories < limits.maxFallbackAdvisories) {
            const fallback = fallbackFor(trigger);
            if (fallback) {
              const fallbackReason = outcome.reason;
              outcome = { kind: 'ready', diagnosis: fallback, latencyMs: 0,
                reason: fallbackReason ? `Fallback after ${fallbackReason}` : 'Deterministic fallback selected',
                rejectedResponses: outcome.rejectedResponses };
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
          finishIntervention(interventionId, trigger, outcome.kind === 'canceled' ? 'cancelled' :
            outcome.kind === 'ready' || outcome.kind === 'abstained' ? 'completed' : 'failed', outcome, source);
          try { recordOutcome(trigger, outcome, outcome.kind, source, interventionId); render(ctx); } catch { /* Metadata is best effort. */ }
          return;
        }
        if (!safeContinuation) {
          failedDeliveries++;
          view.finish('error', 'Advisory could not enter a continuing Worker turn');
          finishIntervention(interventionId, trigger, 'failed', { ...outcome,
            reason: 'Advisory could not enter a continuing Worker turn' }, source);
          recordOutcome(trigger, outcome, 'delivery_failed', source, interventionId);
          render(ctx);
          return;
        }
        const diagnosis = outcome.diagnosis!;
        const adviceKey = `${diagnosis.issue.toLowerCase()}|${diagnosis.next_action.toLowerCase()}`;
        if (adviceKeys.has(adviceKey)) {
          view.finish('abstained', 'Duplicate advisory suppressed');
          finishIntervention(interventionId, trigger, 'completed', { ...outcome,
            reason: 'Duplicate advisory suppressed' }, source);
          recordOutcome(trigger, outcome, 'duplicate', source, interventionId);
          render(ctx);
          return;
        }
        adviceKeys.add(adviceKey);
        delivered++;
        if (source === 'fallback') fallbackAdvisories++;
        else modelAdvisories++;
        lastAdviceEpoch = engine.progressVersion;
        lastAdviceInterventionId = interventionId;
        lastAdviceTool = trigger.tool;
        const advisedOperation = triggerObservation(trigger, engine.recent);
        lastAdviceOperation = advisedOperation ? advisedOperation.operationKey ??
          operationSignature(advisedOperation.toolName, advisedOperation.args) : undefined;
        lastAdviceInspectionReceipt = isInspectionLoop(trigger) ?
          trigger.receiptFingerprint ?? lastObservedResultFingerprint : undefined;
        repeatedAfterAdvice = 0;
        const content = buildWorkerDirective({ trigger, diagnosis, recent: engine.recent, task: engine.task,
          stage: engine.stage, progressVersion: engine.progressVersion, diagnostic: lastDiagnostic,
          source: source ?? 'model' });
        view.finish('delivered', content.split('\n')[1] ?? diagnosis.next_action);
        supervisorActivity = source === 'fallback' ? 'Fallback delivered; Worker continuing' : 'Advisory delivered; Worker continuing';
        finishIntervention(interventionId, trigger, 'completed', outcome, source, true, content);
        try { recordOutcome(trigger, outcome, 'delivered', source, interventionId); render(ctx); } catch { /* Metadata is best effort. */ }
        awaitingContext.add(content);
        contextInterventionIds.set(content, interventionId);
        return { entries: [...event.entries, { type: 'custom_message' as const,
          customType: ADVISORY_TYPE, content, display: false } ] };
      } catch (error) {
        failedDeliveries++;
        const reason = `Delivery failed: ${error instanceof Error ? error.message.slice(0, 100) : 'unknown error'}`;
        finishIntervention(interventionId, trigger, 'failed', { kind: 'failed', latencyMs: 0, reason });
        view.finish('error', reason);
        render(ctx);
      } finally {
        if (ctx.hasUI && engine.sessionId === interventionSessionId) try { ctx.ui.setWorkingMessage(); }
        catch { /* UI cleanup must not change Worker control. */ }
      }
    });

    pi.on('turn_end', event => {
      if (event.outcome !== 'completed' || engine.mode === 'off' ||
          event.message.role !== 'assistant' || event.message.stopReason !== 'stop' ||
          event.toolResults.length > 0 || !event.messageEntryId ||
          event.message.content.some(part => part.type === 'text' ? !!part.text.trim() : part.type !== 'thinking') ||
          handledEmptyFinalMessages.has(event.messageEntryId)) return;
      handledEmptyFinalMessages.add(event.messageEntryId);
      if (emptyFinalContinuationIssued) {
        if (emptyFinalTerminalIssued) return;
        emptyFinalTerminalIssued = true;
        return { entries: [...event.entries, { type: 'custom' as const, customType: EMPTY_FINAL_TYPE,
          data: { stage: engine.stage, messageEntryId: event.messageEntryId, phase: 'stopped' } satisfies EmptyFinalEntry }] };
      }
      emptyFinalContinuationIssued = true;
      const prompt = '[Pi Sitter completion follow-up — extension generated] Your previous turn stopped without a final report. Finish the original task and provide a truthful completion report with what you completed and any remaining gaps. Do not claim tests passed without observed results.';
      return { entries: [...event.entries,
        { type: 'custom' as const, customType: EMPTY_FINAL_TYPE,
          data: { stage: engine.stage, messageEntryId: event.messageEntryId, phase: 'continuing' } satisfies EmptyFinalEntry },
        { type: 'custom_message' as const, customType: EMPTY_FINAL_MESSAGE_TYPE, content: prompt, display: false }],
        continue: true };
    });

    pi.on('agent_before_settle', async (event, ctx) => {
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage ||
          !dependencies.projectDiagnostic || protectedVerifierAvailable()) return;
      const current = new AbortController();
      projectDiagnosticController = current;
      const sessionId = engine.sessionId;
      const prior = activeDiagnosticId && diagnosticCards.get(activeDiagnosticId);
      const followupCard = prior && prior !== 'interrupted' && prior.workerPrompt ? prior : undefined;
      const displayId = followupCard ? activeDiagnosticId! : randomUUID();
      if (!followupCard) activeDiagnosticId = displayId;
      pendingDiagnosticId = displayId;
      if (followupCard) {
        const pendingCard = { ...followupCard, followupPending: true };
        diagnosticCards.set(displayId, pendingCard);
        pi.appendEntry(PROJECT_DIAGNOSTIC_TYPE, pendingCard);
      }
      else pi.appendEntry(PROJECT_DIAGNOSTIC_PENDING_TYPE, { id: displayId, stage: engine.stage });
      if (ctx.hasUI) {
        ctx.ui.setWorkingMessage('Pi Sitter checking saved project…');
        ctx.ui.setWorkingVisible(true);
      }
      let result: ProjectDiagnosticResult;
      let rawResult: ProjectDiagnosticResult | undefined;
      try {
        const candidate = await dependencies.projectDiagnostic(engine.stage, ctx.cwd, current.signal);
        result = boundedProjectDiagnostic(candidate);
        rawResult = candidate;
      } catch (error) {
        result = { status: 'BLOCKED', passed: 0, failed: 0, total: 0,
          reason: error instanceof Error ? error.message.slice(0, 800) : 'Host diagnostic failed' };
      } finally {
        if (projectDiagnosticController === current) projectDiagnosticController = undefined;
      }
      if (current.signal.aborted || engine.sessionId !== sessionId) {
        if (engine.sessionId === sessionId) {
          diagnosticCards.set(displayId, followupCard ? { ...followupCard, followupPending: false,
            followup: { status: 'BLOCKED', passed: 0, failed: 0, total: 0, reason: 'Follow-up diagnostic interrupted' } } : 'interrupted');
          if (pendingDiagnosticId === displayId) pendingDiagnosticId = undefined;
          if (ctx.hasUI) ctx.ui.setWorkingMessage();
        }
        return;
      }
      lastDiagnostic = result.status === 'FAIL' ? { stage: engine.stage, failed: result.failed, total: result.total,
        failures: result.failures ?? [], progressVersion: engine.progressVersion } : undefined;
      let prompt: string | undefined;
      if (result.status === 'FAIL' && !projectDiagnosticRetryIssued && !emptyFinalTerminalIssued && engine.mode === 'active') {
        projectDiagnosticRetryIssued = true;
        prompt = buildProjectDiagnosticPrompt(result, engine.task);
      }
      const card: ProjectDiagnosticCard = followupCard ? { ...followupCard, followupPending: false,
        followup: result, rawFollowup: rawResult, followupProgressVersion: engine.progressVersion,
        workerProgressObserved: engine.progressVersion > (followupCard.progressVersion ?? engine.progressVersion) } :
        { stage: engine.stage, ...result, rawResult,
          progressVersion: engine.progressVersion, displayId, workerPrompt: prompt,
          previousWorkerPrompt: prompt ? undefined : lastProjectDiagnosticPrompt };
      diagnosticCards.set(displayId, card);
      pendingDiagnosticId = undefined;
      if (ctx.hasUI) ctx.ui.setWorkingMessage();
      pi.appendEntry(PROJECT_DIAGNOSTIC_TYPE, card);
      if (!prompt) return;
      lastProjectDiagnosticPrompt = prompt;
      return { entries: [...event.entries,
        { type: 'custom' as const, customType: PROJECT_DIAGNOSTIC_RETRY_TYPE, data: { stage: engine.stage } },
        { type: 'custom_message' as const, customType: PROJECT_DIAGNOSTIC_RETRY_TYPE, content: prompt, display: false }],
        continue: true };
    });

    pi.on('agent_before_settle', (event, ctx) => {
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage || unavailableAtCompletionIssued) return;
      refreshTestDiscovery(ctx);
      if (protectedVerifierAvailable() || dependencies.projectDiagnostic) return;
      unavailableAtCompletionIssued = true;
      showUnavailableVerification(unavailableAtCompletionReason());
    });

    pi.on('agent_before_settle', (event, ctx) => {
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage ||
          !verifierRequested()) return;
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
      if (event.outcome !== 'completed' || engine.mode === 'off' || !engine.stage || !verifierRequested()) return;
      refreshCurrentContext(ctx, true);
      const prerequisite = dependencies.completionReady?.(workerToolNames, pi.getActiveTools());
      if (prerequisite) {
        lastReport = undefined;
        recoveryPlan = undefined;
        const completion: CompletionRecord = { stage: engine.stage, task: engine.task, decision: 'BLOCKED',
          snapshotIdentity: 'unavailable', counts: { PASS: 0, FAIL: 0, UNVERIFIED: 0 },
          failedGateIds: [], unverifiedGateIds: [], regressions: [], attempt: recoveryAttempts,
          elapsedMs: 0, reason: prerequisite, taskId: controllerContext?.taskId,
          attemptSourceSnapshot: controllerContext?.sourceSnapshot,
          suite: controllerContext?.suite && { id: controllerContext.suite.id,
            version: controllerContext.suite.version, digest: controllerContext.suite.digest } };
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
            lastReport.suite.id === currentContext.suite.id && lastReport.suite.version === currentContext.suite.version &&
            lastReport.suite.digest === currentContext.suite.digest &&
            lastReport.gates.some(gate => gate.result === 'FAIL') &&
            lastReport.snapshotIdentity !== currentContext.sourceSnapshot) {
          request = { reason: 'post_repair', milestoneId: 'repair',
            gateIds: lastReport.gates.filter(gate => gate.result === 'FAIL').map(gate => gate.id),
            regressionGateIds: lastReport.gates.filter(gate => gate.result !== 'FAIL').map(gate => gate.id) };
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
      if (emptyFinalTerminalIssued || completion.decision !== 'RECOVERY_REQUIRED' || !currentRecovery() || !recoveryPlan) return;
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
      if (pendingDiagnosticId) {
        const currentCard = diagnosticCards.get(pendingDiagnosticId);
        diagnosticCards.set(pendingDiagnosticId, currentCard && currentCard !== 'interrupted' ?
          { ...currentCard, followupPending: false,
            followup: { status: 'BLOCKED', passed: 0, failed: 0, total: 0,
              reason: 'Follow-up diagnostic interrupted before a result was recorded' } } : 'interrupted');
        pendingDiagnosticId = undefined;
      }
      if (activeDiagnosticId) {
        const card = diagnosticCards.get(activeDiagnosticId);
        if (card && card !== 'interrupted' && card.workerPrompt && !card.guidanceReceived && !card.followup) {
          const failedCard = { ...card, guidanceDeliveryFailed: true };
          diagnosticCards.set(activeDiagnosticId, failedCard);
          try { pi.appendEntry(PROJECT_DIAGNOSTIC_TYPE, failedCard); }
          catch { /* Display failure cannot change Worker control. */ }
        }
      }
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
        cancelInterventions('Session ended during supervision');
        controller?.abort(new Error('Pi Sitter session ended'));
        verificationController?.abort(new Error('Pi Sitter session ended'));
        analysisController?.abort(new Error('Pi Sitter session ended'));
        projectDiagnosticController?.abort(new Error('Pi Sitter session ended'));
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
        interventions.clear();
        receivedInterventions.clear(); failedInterventions.clear(); actedInterventions.clear();
        contextInterventionIds.clear(); lastAdviceInterventionId = undefined;
        workerToolNames.length = 0;
        controller = undefined;
        verificationController = undefined;
        analysisController = undefined;
        lastReport = undefined;
        lastCompletion = undefined;
        verificationCards.clear();
        pendingVerificationId = undefined;
        diagnosticCards.clear();
        activeDiagnosticId = undefined;
        pendingDiagnosticId = undefined;
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
        lastAdviceInspectionReceipt = undefined;
        lastObservedResultFingerprint = undefined;
        repeatedAfterAdvice = 0;
        lastRejectedReason = '';
        awaitingContext.clear();
        lastRenderAt = 0;
        lastStatus = lastWidget = '';
      } catch { /* Teardown cannot block session replacement or quit. */ }
    });

    pi.registerCommand('sitter', {
      description: 'Pi Sitter: use, status, gates, report, recover, verify, off, shadow, on',
      getArgumentCompletions: prefix => ['use', 'status', 'gates', 'report', 'recover', 'verify', 'off', 'shadow', 'on']
        .filter(value => value.startsWith(prefix)).map(value => ({ value, label: value })),
      handler: async (args, ctx) => {
        try {
          const words = args.trim().split(/\s+/);
          const command = words[0]?.toLowerCase() ?? '';
          if (['status', 'gates', 'report', 'recover', 'verify'].includes(command)) refreshCurrentContext(ctx);
          if (!command) view.toggle();
          else if (command === 'use') {
            if (words.length !== 2) throw new Error('Use /sitter use <approved-plan-id>');
            const id = approvedPlanId(words[1]);
            const setup = dependencies.verificationSetup;
            if (!setup?.selectApprovedPlan || !setup.getSelectedPlanId)
              throw new Error('This host does not support plan selection; configure an approved verifier in the host launcher');
            setup.selectApprovedPlan(id, engine.stage, ctx.cwd);
            refreshSelectedPlan(ctx);
            if (selectedPlanId !== id) throw new Error('Host did not confirm the selected verifier plan');
            announceReadiness(ctx);
            ctx.ui.notify(`Pi Sitter selected host-approved plan ${id}; ${readinessState?.summary}`, 'info');
          }
          else if (command === 'verify') {
            refreshTestDiscovery(ctx);
            const unavailable = !ctx.isIdle() ? 'Run /sitter verify after the Worker turn completes' :
              noTestsMode ? 'No test command found; Pi Sitter is in no-tests mode and cannot mark this task VERIFIED' :
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
            const state = refreshReadiness(ctx);
            ctx.ui.notify(`Pi Sitter ${engine.mode}; readiness ${state.status}; ${testSetupSummary()}; Worker ${workerState}; stage ${engine.stage || 'unset'}; gates ${lastCompletion?.decision ?? 'pending'}; ${verificationActivity}; verification ${verificationElapsedMs} ms (${verificationRuns}/${limits.maxCompletionVerifications}); recovery ${recoveryAttempts}/${limits.maxRecoveryAttempts}; diagnosis ${completionDiagnosisCalls}/1; recovery generation ${recoveryGenerationCalls}/1; unresolved ${unresolvedIds().join(', ') || 'none'}; ${attemptLabel(lastCompletion)}; status ${view.phase}${view.result ? `: ${view.result}` : ''}; last rejected ${lastRejectedReason || "none"}; triggers ${engine.triggerCount}; inference ${calls}/${limits.maxInferenceAttempts}; valid ${validDiagnoses}; model delivered ${modelAdvisories}/${limits.maxValidAdvisories}; fallback delivered ${fallbackAdvisories}/${limits.maxFallbackAdvisories}; delivered ${delivered}; confirmed ${confirmedDeliveries}; failed deliveries ${failedDeliveries}; Worker recoveries ${workerRecoveries}; abstained ${abstained}; failed ${failed}; budget ${remaining()}; tokens ${inputTokens}/${outputTokens}; latency ${totalLatencyMs} ms; observer ${engine.overheadMs.toFixed(1)} ms`, 'info');
          } else if (command === 'gates') {
            const gates = controllerContext?.suite.gates ?? [];
            ctx.ui.notify(gates.length ? `Host-provided protected gates for ${engine.stage}:\n${gates.map(gate => `${gate.id}: ${lastReport?.gates.find(row => row.id === gate.id)?.result ?? 'PENDING'} — requirements ${gate.requirementIds.join(', ')}`).join('\n')}` : 'No trusted gate contract is available for this stage', gates.length ? 'info' : 'warning');
          } else if (command === 'report') {
            refreshTestDiscovery(ctx);
            const currentReport = sameAttempt(lastReport, lastCompletion) ? lastReport : undefined;
            const unresolved = currentReport?.gates.filter(gate => gate.result !== 'PASS') ?? [];
            const requirements = lastCompletion?.requirements ?? [];
            ctx.ui.notify(lastCompletion ? `Stage ${lastCompletion.stage}: ${lastCompletion.decision}; ${lastCompletion.counts.PASS} PASS, ${lastCompletion.counts.FAIL} FAIL, ${lastCompletion.counts.UNVERIFIED} UNVERIFIED; ${attemptLabel(lastCompletion)}; regressions: ${lastCompletion.regressions.join(', ') || 'none'}; snapshot ${lastCompletion.snapshotIdentity}; ${lastCompletion.reason}${currentReport?.supervisorSessionFile ? `\nSupervisor Pi transcript: ${currentReport.supervisorSessionFile}` : ''}${unresolved.length ? `\nUnresolved gates:\n${unresolved.map(gate => `${gate.id} ${gate.result}: ${gate.evidence}`).join('\n')}` : ''}${requirements.length ? `\nOriginal requirements:\n${requirements.map(row => `${row.id} ${row.status}: ${row.reason}${row.evidence.length ? ` [${row.evidence.map(item => `${item.path}:${item.line}`).join(', ')}]` : ''}${row.limitations.length ? `; limitations: ${row.limitations.join('; ')}` : ''}`).join('\n')}` : ''}${currentReport?.validationLimitations.length ? `\nLimitations: ${currentReport.validationLimitations.join('; ')}` : ''}` : noTestsMode ? `${testSetupSummary()}; no verification report is available` : 'No verification report is available', lastCompletion ? 'info' : 'warning');
          } else if (command === 'recover') {
            const unavailable = !currentRecovery() ? 'No failed gate recovery is pending' :
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
              cancelInterventions('Pi Sitter disabled during supervision');
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
          } else ctx.ui.notify('Use /sitter [setup|use <approved-plan-id>|status|gates|report|recover|verify|off|shadow|on]', 'info');
          render(ctx);
        } catch (error) {
          ctx.ui.notify(`Pi Sitter command could not complete: ${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}`, 'warning');
        }
      },
    });
  };
}

export default function piSitter(pi: ExtensionAPI): void { createPiSitter()(pi); }
