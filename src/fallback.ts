import type { ToolObservation, Trigger } from './core.ts';
import type { Diagnosis } from './inference.ts';

export type FallbackProvider = (trigger: Trigger, recent: readonly ToolObservation[]) => Diagnosis | undefined;

function argumentsOf(event: ToolObservation | undefined): Record<string, unknown> {
  if (!event) return {};
  if (event.args && typeof event.args === 'object' && !Array.isArray(event.args)) return event.args as Record<string, unknown>;
  if (typeof event.args === 'string') {
    try {
      const parsed = JSON.parse(event.args);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* Untrusted arguments are ignored. */ }
  }
  return {};
}

export function genericFallback(trigger: Trigger, recent: readonly ToolObservation[]): Diagnosis | undefined {
  if (trigger.type === 'T1' && trigger.tool === 'edit' &&
      /No changes made to .+?\. The replacement produced identical content\./i.test(trigger.evidence)) {
    return {
      issue: 'Repeated text edit produced no change',
      evidence: 'The replacement produced identical content.',
      next_action: 'Stop repeating the edit. Inspect the target file and intended replacement, then choose a different source correction. Do not edit protected acceptance tests.',
      confidence: 0.95,
      abstain: false,
    };
  }
  if (trigger.type === 'T1' && /^(?:bash|shell|exec)$/.test(trigger.tool) && /AssertionError:/.test(trigger.evidence)) {
    const assertion = trigger.evidence.match(/AssertionError:[^\n]{0,180}/)?.[0];
    if (assertion) return {
      issue: 'Repeated test run has a failing assertion',
      evidence: assertion,
      next_action: 'Inspect the failing assertion and compare expected with actual output before choosing a source correction.',
      confidence: 0.8,
      abstain: false,
    };
  }
  if (trigger.type !== 'T4' || !/equivalent successful calls with no progress/i.test(trigger.evidence)) return;
  const last = [...recent].reverse().find(event => event.toolName === trigger.tool);
  if (!last) return;
  const args = argumentsOf(last);
  const target = typeof args.property === 'string' ? args.property.slice(0, 48) : 'target';
  const nullWarning = Object.hasOwn(args, 'value') && args.value === null ? ' Do not repeat the null assignment.' : '';
  return {
    issue: `Repeated mutation made no change to ${target}`,
    evidence: 'equivalent successful calls with no progress',
    next_action: `Inspect the actual target and resource state, then choose a different corrective operation.${nullWarning}`,
    confidence: 0.95,
    abstain: false,
  };
}
