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
