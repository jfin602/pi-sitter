import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { Trigger } from './core.ts';
import type { PiSitterLimits } from './config.ts';
import { buildPrompt, type PromptBuilder, type PromptInput } from './prompt.ts';

export interface Diagnosis {
  issue: string;
  evidence: string;
  next_action: string;
  confidence: number;
  abstain: boolean;
}

export type InferenceOutcome = {
  kind: 'ready' | 'abstained' | 'failed' | 'timeout' | 'canceled';
  diagnosis?: Diagnosis;
  reason?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  invalidOutput?: boolean;
  validation?: { field: string; actual: number; max: number };
};

export type LoadedCheck = (ctx: ExtensionContext, signal: AbortSignal) => Promise<boolean>;

/** The host selected model is the only model Pi Sitter uses. No model is loaded at startup. */
export async function checkLoadedModel(ctx: ExtensionContext, signal: AbortSignal): Promise<boolean> {
  return !signal.aborted && Boolean(ctx.model);
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
}

export function parseDiagnosis(raw: string, trigger: Trigger): { kind: 'ready' | 'abstained' | 'failed'; diagnosis?: Diagnosis; reason?: string; validation?: { field: string; actual: number; max: number } } {
  if (raw.length > 3000) return { kind: 'failed', reason: `response length ${raw.length} exceeds 3000`, validation: { field: 'response', actual: raw.length, max: 3000 } };
  const trimmed = raw.trim();
  // Gemma sometimes wraps an otherwise valid JSON object in one Markdown fence.
  // Accept only a fence around the entire response; commentary remains invalid.
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  let value: unknown;
  try { value = JSON.parse(candidate); } catch { return { kind: 'failed', reason: 'malformed JSON' }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { kind: 'failed', reason: 'response is not an object' };
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort().join(',');
  if (keys !== ['abstain', 'confidence', 'evidence', 'issue', 'next_action'].join(',')) return { kind: 'failed', reason: 'unexpected diagnosis fields' };
  if (typeof object.abstain !== 'boolean' || typeof object.confidence !== 'number' || !Number.isFinite(object.confidence) || object.confidence < 0 || object.confidence > 1) {
    return { kind: 'failed', reason: 'invalid abstention or confidence' };
  }
  for (const [field, max] of [['issue', 180], ['evidence', 220], ['next_action', 220]] as const) {
    const text = object[field];
    if (typeof text !== 'string') return { kind: 'failed', reason: `${field} must be a string` };
    if (text.length > max) return { kind: 'failed', reason: `${field} length ${text.length} exceeds ${max}`,
      validation: { field, actual: text.length, max } };
  }
  const diagnosis = object as unknown as Diagnosis;
  if (diagnosis.abstain || diagnosis.confidence < 0.6) return { kind: 'abstained', diagnosis, reason: diagnosis.abstain ? 'model abstained' : 'low confidence' };
  if (!validText(diagnosis.issue, 180) || !validText(diagnosis.evidence, 220) || !validText(diagnosis.next_action, 220)) return { kind: 'failed', reason: 'missing diagnosis field' };
  if (diagnosis.evidence.length < 12 || !trigger.evidence.includes(diagnosis.evidence)) return { kind: 'failed', reason: 'evidence is not grounded in the trigger' };
  if (/ignore (?:all|previous)|system prompt|developer instructions|send (?:secrets|credentials)/i.test(diagnosis.next_action)) return { kind: 'failed', reason: 'unsafe action text' };
  return { kind: 'ready', diagnosis };
}

export async function runInference(
  ctx: ExtensionContext,
  input: PromptInput,
  limits: PiSitterLimits,
  signal: AbortSignal,
  onText: (text: string) => void,
  loadedCheck: LoadedCheck = checkLoadedModel,
  promptBuilder: PromptBuilder = buildPrompt,
): Promise<InferenceOutcome> {
  const start = performance.now();
  const controller = new AbortController();
  let timedOut = false;
  let tooLong = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(new Error('Pi Sitter timeout')); }, limits.timeoutMs);
  const relay = () => controller.abort(signal.reason);
  signal.addEventListener('abort', relay, { once: true });
  if (signal.aborted) relay();
  const outcome = (kind: InferenceOutcome['kind'], extra: Partial<InferenceOutcome> = {}): InferenceOutcome => ({ kind, latencyMs: Math.round(performance.now() - start), ...extra });
  try {
    if (controller.signal.aborted) return outcome(timedOut ? 'timeout' : 'canceled');
    const selected = ctx.model;
    if (!await loadedCheck(ctx, controller.signal)) return outcome('failed', { reason: 'Selected Worker model is unavailable' });
    const model = ctx.model;
    if (!model || model.id !== selected?.id || model.provider !== selected?.provider)
      return outcome('failed', { reason: 'Worker model changed during diagnosis' });
    const prompt = promptBuilder(input, limits.maxInputChars);
    const stream = ctx.modelRegistry.streamSimple(model, {
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt.userText }], timestamp: Date.now() }],
    }, { maxTokens: limits.maxOutputTokens, timeoutMs: limits.timeoutMs,
      maxRetries: 0, signal: controller.signal, cacheRetention: 'none', disableContinuation: true });
    let visible = '';
    let finalMessage: { content?: Array<{ type: string; text?: string }>; usage?: { input?: number; output?: number }; stopReason?: string } | undefined;
    for await (const event of stream) {
      if (controller.signal.aborted) break;
      if (event.type === 'text_delta') {
        visible += event.delta;
        if (visible.length > 3000) { tooLong = true; controller.abort(new Error('Pi Sitter response too long')); break; }
        try { onText(visible); } catch { /* UI failure cannot break inference. */ }
      } else if (event.type === 'done') finalMessage = event.message;
      else if (event.type === 'error') return outcome(controller.signal.aborted ? (timedOut ? 'timeout' : 'canceled') : 'failed', { reason: event.error.errorMessage ?? 'stream error' });
    }
    if (controller.signal.aborted) return outcome(timedOut ? 'timeout' : signal.aborted ? 'canceled' : 'failed', {
      reason: timedOut ? `${Math.round(limits.timeoutMs / 1000)} second timeout` : tooLong ? `response length ${visible.length} exceeds 3000` : 'stream canceled',
      invalidOutput: tooLong,
      validation: tooLong ? { field: 'response', actual: visible.length, max: 3000 } : undefined,
    });
    if (!finalMessage) return outcome('failed', { reason: 'stream ended without completion' });
    if (finalMessage.stopReason !== 'stop') return outcome('failed', {
      reason: `stream stopped: ${finalMessage.stopReason ?? 'unknown'}`,
      invalidOutput: finalMessage.stopReason === 'length',
    });
    const finalText = finalMessage.content?.filter(part => part.type === 'text').map(part => part.text ?? '').join('') ?? '';
    const parsed = parseDiagnosis(finalText || visible, input.trigger);
    return outcome(parsed.kind, { diagnosis: parsed.diagnosis, reason: parsed.reason,
      invalidOutput: parsed.kind === 'failed', validation: parsed.validation,
      inputTokens: finalMessage.usage?.input, outputTokens: finalMessage.usage?.output });
  } catch (error) {
    return outcome(timedOut ? 'timeout' : signal.aborted ? 'canceled' : 'failed', { reason: error instanceof Error ? error.message.slice(0, 160) : 'inference failed' });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', relay);
  }
}
