import { createHash } from 'node:crypto';

export type PiSitterMode = 'off' | 'shadow' | 'active';
export type TriggerType = 'T1' | 'T2' | 'T3' | 'T4';
export type ObservationClass = 'PROGRESS' | 'NO_CHANGE' | 'ERROR' | 'INSPECTION' | 'UNKNOWN';

export interface ToolObservation {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  operationKey?: string;
  result?: unknown;
  isError: boolean;
  durationMs?: number;
}

export interface Trigger {
  type: TriggerType;
  tool: string;
  evidence: string;
  key: string;
  stage?: string;
}

export interface MilestoneEvidence {
  stage: string;
  gameDir: string;
  final: boolean;
}

export type Validator = (evidence: MilestoneEvidence) => string | undefined;

const MAX_TOOLS = 32;
const MAX_TRIGGERS = 16;
const MAX_MILESTONES = 16;
const MAX_SIGNATURES = 16;
const MAX_STAGNANT = 12;
const MAX_TEXT = 200;

function bounded<T>(array: T[], value: T, limit: number): void {
  array.push(value);
  if (array.length > limit) array.splice(0, array.length - limit);
}

function compact(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 4096);
  if (value && typeof value === 'object') {
    const content = (value as { content?: unknown }).content;
    if (Array.isArray(content)) {
      let text = '';
      for (const item of content) {
        if (item?.type !== 'text') continue;
        text += String(item.text ?? '').slice(0, 4096 - text.length);
        if (text.length >= 4096) break;
        text += '\n';
      }
      return text.slice(0, 4096);
    }
  }
  return '';
}

function resultBody(value: unknown): Record<string, unknown> | undefined {
  const raw = compact(value);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined;
  } catch { return; }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function operationSignature(name: string, input: unknown): string {
  let args = input;
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { /* Use raw arguments. */ } }
  return `${name}|${createHash('sha256').update(stable(args ?? {})).digest('hex')}`;
}

function isMutation(name: string): boolean {
  return /(?:create_|set_|write|attach_|save_scene|add_|remove_|delete_|rename_|update_|apply_)/.test(name);
}

function isInspection(name: string): boolean {
  return /(?:get_|list_|read|inspect|parse_errors|scene_tree|tool_search)/.test(name) && !isMutation(name);
}

function noChange(event: ToolObservation): string | undefined {
  const body = resultBody(event.result);
  if (!body) return;
  const receipt = body.receipt as { status?: string; changes?: unknown } | undefined;
  const status = receipt?.status?.toLowerCase();
  const empty = Array.isArray(receipt?.changes) && receipt.changes.length === 0;
  const unchanged = Array.isArray(receipt?.changes) && receipt.changes.length > 0 && receipt.changes.every(change => {
    if (!change || typeof change !== 'object') return false;
    const record = change as Record<string, unknown>;
    return /^(?:set|write|update|replace)$/.test(String(record.op ?? '')) &&
      'before' in record && 'after' in record && stable(record.before) === stable(record.after);
  });
  if ((status === 'no-op' || status === 'noop' || status === 'unchanged' || status === 'existed') &&
      (!Array.isArray(receipt?.changes) || empty)) {
    return `receipt status ${status}; ${empty ? 'changes []' : 'no recorded modification'}`;
  }
  if (isMutation(event.toolName) && empty && status) return `receipt status ${status}; changes []`;
  if (isMutation(event.toolName) && unchanged) return 'receipt changes have identical before and after values';
  if (isMutation(event.toolName) && (body.changed === false || body.no_op === true || empty)) return 'successful call recorded no change';
  if (isMutation(event.toolName) && body.set === false) return 'setter reported set=false';
  if (isMutation(event.toolName) && body.created === false) return 'creator reported created=false';
  if (isMutation(event.toolName) && body.dry_run === true) return 'dry_run=true; no saved change';
}

export function failed(event: ToolObservation): boolean {
  if (event.isError) return true;
  const body = resultBody(event.result);
  if (!body) return false;
  const receipt = body.receipt as { status?: string } | undefined;
  return body.ok === false || body.success === false || (body.error != null && body.error !== false && body.error !== '') ||
    (Array.isArray(body.errors) && body.errors.length > 0) || ['error', 'failed'].includes(String(receipt?.status ?? '').toLowerCase());
}

/** Interpret the receipt, not merely the transport success or persisted flag. */
export function classifyObservation(event: ToolObservation): { kind: ObservationClass; reason: string } {
  if (failed(event)) return { kind: 'ERROR', reason: failureText(event) };
  if (isInspection(event.toolName) || isSetup(event.toolName)) return { kind: 'INSPECTION', reason: 'read-only operation' };
  if (!isMutation(event.toolName)) return { kind: 'UNKNOWN', reason: 'unclassified operation' };
  const unchanged = noChange(event);
  if (unchanged) return { kind: 'NO_CHANGE', reason: unchanged };
  const body = resultBody(event.result);
  const receipt = body?.receipt as { status?: string; changes?: unknown } | undefined;
  const changes = receipt?.changes;
  const status = String(receipt?.status ?? '').toLowerCase();
  if (Array.isArray(changes) && changes.length > 0 && ['created', 'updated'].includes(status))
    return { kind: 'PROGRESS', reason: `receipt status ${status}; ${changes.length} change(s)` };
  if (body?.created === true || body?.set === true)
    return { kind: 'PROGRESS', reason: body.created === true ? 'created=true' : 'set=true' };
  return { kind: 'UNKNOWN', reason: 'mutation result lacks proof of a saved change' };
}

function failureText(event: ToolObservation): string {
  const body = resultBody(event.result);
  const raw = body?.error ?? body?.errors ?? body?.message ?? compact(event.result) ?? 'tool failed';
  return (typeof raw === 'string' ? raw : JSON.stringify(raw)).slice(0, MAX_TEXT);
}

function signature(event: ToolObservation): string {
  return `${event.toolName}|${failureText(event).toLowerCase().replace(/\bline\s+\d+\b/g, 'line #').replace(/\b\d+\b/g, '#').replace(/\s+/g, ' ').slice(0, 120)}`;
}

function isSetup(name: string): boolean {
  return name === 'tool_search' || /(?:list_toolsets|enable_toolset|health_check|get_project_info)$/.test(name);
}

function resolvesFailure(event: ToolObservation, signatures: { signature: string }[]): boolean {
  const classification = classifyObservation(event).kind;
  if (classification !== 'PROGRESS' && classification !== 'INSPECTION') return false;
  if (event.toolName.endsWith('get_parse_errors') && signatures.length > 0) return true;
  return classification === 'PROGRESS' && signatures.some(item => item.signature.startsWith(`${event.toolName}|`));
}

export class PiSitterEngine {
  mode: PiSitterMode;
  readonly recent: ToolObservation[] = [];
  readonly triggers: Trigger[] = [];
  readonly milestones: string[] = [];
  readonly failureSignatures: { signature: string; count: number; epoch: number }[] = [];
  task = '';
  stage = '';
  sessionId = '';
  overheadMs = 0;
  private progressEpoch = 0;
  private failureEpoch = 0;
  private setupHistory: string[] = [];
  private stagnantHistory: { operation: string; receipt: string; epoch: number; kind: 'no-change' | 'inspection' }[] = [];
  private recovery = false;
  private duplicateKeys = new Set<string>();
  private readonly maxTriggers: number;
  private readonly noChangeThreshold: number;

  constructor(mode: PiSitterMode = 'off', options: { maxTriggers?: number; noChangeThreshold?: number } = {}) {
    this.mode = mode;
    this.maxTriggers = options.maxTriggers ?? 16;
    this.noChangeThreshold = options.noChangeThreshold ?? 2;
  }

  get budgetRemaining(): number { return Math.max(0, this.maxTriggers - this.triggers.length); }
  get triggerCount(): number { return this.triggers.length; }
  get progressVersion(): number { return this.progressEpoch; }

  reset(mode: PiSitterMode = this.mode): void {
    this.mode = mode;
    this.recent.length = 0;
    this.triggers.length = 0;
    this.milestones.length = 0;
    this.failureSignatures.length = 0;
    this.task = '';
    this.stage = '';
    this.sessionId = '';
    this.overheadMs = 0;
    this.progressEpoch = 0;
    this.failureEpoch = 0;
    this.setupHistory.length = 0;
    this.stagnantHistory.length = 0;
    this.recovery = false;
    this.duplicateKeys.clear();
  }

  setTask(task: string, stage = ''): void {
    this.task = task.slice(0, 700);
    this.stage = stage;
  }

  setMode(mode: PiSitterMode): void {
    this.mode = mode;
    if (mode === 'off') {
      this.setupHistory.length = 0;
      this.failureSignatures.length = 0;
      this.stagnantHistory.length = 0;
    }
  }

  restoreTrigger(trigger: Trigger): void {
    if (this.triggers.length < this.maxTriggers) {
      this.triggers.push(trigger);
      this.duplicateKeys.add(trigger.key);
    }
  }

  observe(event: ToolObservation): Trigger | undefined {
    if (this.mode === 'off') return;
    const start = performance.now();
    try {
      const classification = classifyObservation(event);
      const error = classification.kind === 'ERROR';
      const argsKey = event.operationKey ?? operationSignature(event.toolName, event.args);
      const argsPreview = (typeof event.args === 'string' ? event.args : JSON.stringify(event.args ?? {})).slice(0, 256);
      bounded(this.recent, { ...event, args: argsPreview, isError: error, result: compact(event.result).slice(0, 400) }, MAX_TOOLS);
      if (classification.kind === 'PROGRESS') {
        this.progressEpoch++;
        this.setupHistory.length = 0;
        this.stagnantHistory.length = 0;
        this.recovery = false;
        if (resolvesFailure(event, this.failureSignatures)) {
          this.failureEpoch++;
          this.failureSignatures.length = 0;
        }
        bounded(this.milestones, event.toolName, MAX_MILESTONES);
        return;
      }
      if (resolvesFailure(event, this.failureSignatures)) {
        this.failureEpoch++;
        this.failureSignatures.length = 0;
        this.recovery = false;
        this.stagnantHistory.length = 0;
      }
      if (error) {
        this.recovery = true;
        this.setupHistory.length = 0;
        const sig = signature(event);
        const previous = this.failureSignatures.find(x => x.signature === sig && x.epoch === this.failureEpoch);
        if (previous) previous.count++;
        else bounded(this.failureSignatures, { signature: sig, count: 1, epoch: this.failureEpoch }, MAX_SIGNATURES);
        const count = previous?.count ?? 1;
        if (count >= 2) return this.emit({ type: 'T1', tool: event.toolName, evidence: `${count} equivalent failures: ${failureText(event)}`, key: `T1:${sig}:${this.failureEpoch}` });
        return;
      }
      const noChangeEvidence = classification.kind === 'NO_CHANGE' ? classification.reason : undefined;
      if (noChangeEvidence && (isMutation(event.toolName) || /open_scene$/.test(event.toolName))) {
        this.recovery = true;
        bounded(this.stagnantHistory, { operation: argsKey, receipt: noChangeEvidence, epoch: this.progressEpoch, kind: 'no-change' }, MAX_STAGNANT);
        const count = this.stagnantHistory.filter(item => item.operation === argsKey && item.epoch === this.progressEpoch && item.kind === 'no-change').length;
        if (count >= (/open_scene$/.test(event.toolName) ? Math.max(3, this.noChangeThreshold) : this.noChangeThreshold)) return this.emit({ type: 'T4', tool: event.toolName,
          evidence: `${count} equivalent successful calls with no progress: ${noChangeEvidence}`,
          key: `T4:${argsKey}:${this.progressEpoch}` });
      } else if (this.recovery && isInspection(event.toolName) && !isSetup(event.toolName)) {
        const receipt = compact(event.result).slice(0, 300);
        bounded(this.stagnantHistory, { operation: argsKey, receipt, epoch: this.progressEpoch, kind: 'inspection' }, MAX_STAGNANT);
        const count = this.stagnantHistory.filter(item => item.operation === argsKey && item.receipt === receipt && item.epoch === this.progressEpoch && item.kind === 'inspection').length;
        if (count >= 3) return this.emit({ type: 'T4', tool: event.toolName,
          evidence: `${count} identical inspections of unchanged state during recovery`,
          key: `T4:${argsKey}:${receipt}:${this.progressEpoch}` });
      }
      if (isSetup(event.toolName)) {
        const setup = `${event.toolName}:${argsKey}`;
        bounded(this.setupHistory, setup, 8);
        const count = this.setupHistory.filter(value => value === setup).length;
        // Repeated enabling is suspicious after two calls; general discovery needs three.
        const limit = /enable_toolset$/.test(event.toolName) ? 2 : 3;
        if (count >= limit || (this.setupHistory.length >= 5 && new Set(this.setupHistory).size <= 2)) {
          return this.emit({ type: 'T2', tool: event.toolName, evidence: `${this.setupHistory.length} setup calls without downstream progress (${count} equivalent)`, key: `T2:${setup}:${this.progressEpoch}` });
        }
      }
    } finally { this.overheadMs += performance.now() - start; }
  }

  milestone(evidence: MilestoneEvidence, validators: Record<string, Validator>): Trigger | undefined {
    if (this.mode === 'off' || !evidence.final) return;
    const start = performance.now();
    try {
      const validator = validators[evidence.stage];
      if (!validator) return;
      const problem = validator(evidence);
      if (!problem) return;
      return this.emit({ type: 'T3', tool: 'milestone validation', stage: evidence.stage,
        evidence: problem.slice(0, MAX_TEXT), key: `T3:${evidence.stage}:${problem}` });
    } finally { this.overheadMs += performance.now() - start; }
  }

  private emit(trigger: Trigger): Trigger | undefined {
    if (this.budgetRemaining === 0 || this.duplicateKeys.has(trigger.key)) return;
    this.duplicateKeys.add(trigger.key);
    bounded(this.triggers, trigger, MAX_TRIGGERS);
    return trigger;
  }
}
