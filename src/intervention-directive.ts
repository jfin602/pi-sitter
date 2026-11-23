import { operationSignature, type ToolObservation, type Trigger } from './core.ts';
import type { Diagnosis } from './inference.ts';

export interface DiagnosticEvidence {
  stage: string;
  failed: number;
  total: number;
  failures: { id: string; detail: string }[];
  progressVersion: number;
}

const clean = (value: string, max = 180): string => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function argsOf(event: ToolObservation | undefined): string {
  if (!event) return '(arguments unavailable)';
  const raw = typeof event.args === 'string' ? event.args : JSON.stringify(event.args ?? {});
  return clean(raw ?? '{}', 180);
}

function resultText(event: ToolObservation | undefined): string {
  if (!event) return '';
  return typeof event.result === 'string' ? event.result : JSON.stringify(event.result ?? '');
}

export function triggerObservation(trigger: Trigger, recent: readonly ToolObservation[]): ToolObservation | undefined {
  if (trigger.type === 'T4' || trigger.type === 'T5') {
    return [...recent].reverse().find(event => event.toolName === trigger.tool &&
      trigger.key.startsWith(`${trigger.type}:${event.operationKey ?? operationSignature(event.toolName, event.args)}:`));
  }
  return [...recent].reverse().find(event => event.toolName === trigger.tool);
}

function receiptFacts(event: ToolObservation | undefined, evidence: string): string[] {
  const raw = `${resultText(event)} ${evidence}`;
  const facts: string[] = [];
  for (const [pattern, label] of [
    [/(?:"dry_run"\s*:\s*true|dry_run:true)/, 'dry_run:true'],
    [/(?:"saved"\s*:\s*false|saved:false)/, 'saved:false'],
    [/(?:"created"\s*:\s*false|created:false)/, 'created:false'],
    [/(?:"attached"\s*:\s*false|attached:false)/, 'attached:false'],
    [/(?:"changes"\s*:\s*\[\s*\]|changes:\[\])/, 'changes:[]'],
  ] as const) if (pattern.test(raw)) facts.push(label);
  const status = /"status"\s*:\s*"(noop|no-op|unchanged|existed)"/i.exec(raw)?.[1];
  if (status) facts.push(`receipt.status:${status.toLowerCase()}`);
  return facts;
}

export function isInspectionLoop(trigger: Trigger): boolean {
  return trigger.type === 'T5' || trigger.type === 'T4' && /identical inspections/i.test(trigger.evidence);
}

function targetOf(event: ToolObservation): string | undefined {
  let args: unknown = event.args;
  if (typeof args === 'string') try { args = JSON.parse(args); } catch { return; }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return;
  for (const [key, value] of Object.entries(args)) {
    if (/(?:^|_)(?:path|file|uri)$/.test(key) && typeof value === 'string' && value.length <= 160 && value.trim())
      return clean(value, 160);
  }
}

function alternateRead(trigger: Trigger, recent: readonly ToolObservation[], task: string,
  diagnostic?: DiagnosticEvidence): string | undefined {
  const candidates = [...recent].reverse().filter(event => {
    if (event.toolName === trigger.tool || !/(?:get_|list_|read|inspect)/.test(event.toolName) ||
        /(?:parse_errors|health_check|get_project_info|tool_search)/.test(event.toolName)) return false;
    const target = targetOf(event);
    if (!target) return false;
    if (!event.isError) return true;
    const index = recent.indexOf(event);
    return recent.slice(index + 1).some(later => {
      const raw = resultText(later);
      return raw.includes(target) && !/"dry_run"\s*:\s*true/.test(raw) &&
        /"(?:created|saved)"\s*:\s*true|"status"\s*:\s*"(?:created|updated)"/.test(raw);
    });
  });
  const taskLower = task.toLowerCase();
  const diagnosticIds = (diagnostic?.failures ?? []).map(row => row.id.toLowerCase());
  const match = candidates.sort((a, b) => {
    const score = (event: ToolObservation) => {
      const target = targetOf(event)!.toLowerCase();
      const stem = target.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? '';
      const diagnosticHits = stem.length >= 3 ? diagnosticIds.filter(id =>
        id.split(/[^a-z0-9]+/).includes(stem)).length : 0;
      return diagnosticHits * 10 + Number(taskLower.includes(target));
    };
    return score(b) - score(a);
  })[0];
  if (match) return `Read ${JSON.stringify(targetOf(match))} with ${clean(match.toolName, 100)}; compare the saved content with the task and any diagnostic mismatch.`;
  const taskTarget = explicitPath(task).find(path => /\.(?:gd|tscn|tres|ts|tsx|js|jsx|py|rs|go|java|kt|swift|json|toml|yaml|yml)$/i.test(path) &&
    !/(?:^|\/)(?:test|tests|test-results|protected-suites)\//i.test(path));
  if (!taskTarget) return;
  if (taskTarget.startsWith('res://')) {
    const relative = taskTarget.slice('res://'.length);
    return `Inspect the saved ${JSON.stringify(taskTarget)} with an appropriate Godot operation, or read ${JSON.stringify(relative)} with a file tool. Compare it with the requested repair; file tools do not use the res:// prefix.`;
  }
  return `Read the task-named ${JSON.stringify(taskTarget)} using a different operation; compare its saved content with the requested repair.`;
}

function fileToolPathCorrection(trigger: Trigger, event: ToolObservation | undefined): string | undefined {
  if (trigger.type !== 'T1' || !/^(?:read|ls)$/.test(trigger.tool) || !event) return;
  let args: unknown = event.args;
  if (typeof args === 'string') try { args = JSON.parse(args); } catch { return; }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return;
  const path = (args as { path?: unknown }).path;
  if (typeof path !== 'string' || !/^res:\/\/[A-Za-z0-9_./-]+$/.test(path) || path.includes('..') ||
      !/\bres:\//.test(resultText(event))) return;
  return `Use ${trigger.tool} with ${JSON.stringify({ path: path.slice('res://'.length) })} to inspect the project path. Ordinary file tools need a project-relative path; Godot operations use res:// paths.`;
}

function explicitPath(value: string): string[] {
  return [...value.matchAll(/(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|(?<![\w:])\/|\.\.?\/|(?:src|scripts|scenes|assets|test|tests)\/)[^\s`'"),;]+/g)]
    .map(match => match[0].replace(/[.:]+$/, ''));
}

function receiptPathText(event: ToolObservation): string {
  try {
    const body = JSON.parse(resultText(event)) as Record<string, unknown>;
    const paths = Object.entries(body).filter(([key, value]) =>
      /(?:^|_)(?:path|file|uri)$/.test(key) && typeof value === 'string').map(([, value]) => value);
    const changes = (body.receipt as { changes?: unknown } | undefined)?.changes;
    if (Array.isArray(changes)) for (const change of changes) if (change && typeof change === 'object' &&
        typeof (change as { path?: unknown }).path === 'string') paths.push((change as { path: string }).path);
    return paths.join(' ');
  } catch { return ''; }
}

function namesDifferentObservedTool(action: string, trigger: Trigger, recent: readonly ToolObservation[]): boolean {
  return recent.some(event => event.toolName !== trigger.tool &&
    (action.includes(event.toolName) || action.includes(event.toolName.split('__').at(-1) ?? event.toolName)));
}

/** Reject a syntactically valid suggestion that sends the Worker back to the same read or invents a target. */
export function weakLoopAction(trigger: Trigger, diagnosis: Diagnosis, recent: readonly ToolObservation[], task: string,
  diagnostic?: DiagnosticEvidence): string | undefined {
  if (trigger.type !== 'T4' && trigger.type !== 'T5') return;
  const action = diagnosis.next_action.trim();
  const last = triggerObservation(trigger, recent);
  const repeatedName = trigger.tool.split('__').at(-1) ?? trigger.tool;
  const distinctPath = explicitPath(action).some(path => !argsOf(last).includes(path));
  if ((action.includes(trigger.tool) || action.includes(repeatedName)) && !distinctPath ||
      isInspectionLoop(trigger) && /(?:inspect|read|check)\s+(?:the\s+)?(?:scene\s+tree|same\s+(?:scene|state|result))/i.test(action))
    return 'next_action repeats the ineffective operation';
  if (/\b(?:create|recreate|overwrite|delete|remove|modify|edit|write)\b/i.test(action) &&
      !/^(?:stop|report)\b/i.test(action)) return 'next_action skips the distinct evidence read';
  const corpus = [task, ...recent.map(event => `${argsOf(event)} ${receiptPathText(event)}`),
    ...conciseDiagnosticFailures(diagnostic?.failures ?? [], 20)].join('\n');
  if (explicitPath(action).some(path => !corpus.includes(path))) return 'next_action names a path absent from current evidence';
  if (isInspectionLoop(trigger) && !/(?:stop|report|block)/i.test(action) &&
      !explicitPath(action).length && !namesDifferentObservedTool(action, trigger, recent))
    return 'next_action has no distinct, specific evidence path';
  if (/^(?:inspect|check|read|compare)\s+(?:the\s+)?(?:expected|current|actual|target|project|source|scene)\b/i.test(action) &&
      !explicitPath(action).length && !namesDifferentObservedTool(action, trigger, recent))
    return 'next_action is a generic inspection request';
  if (last && /\b(?:again|retry|repeat)\b/i.test(action) && !/(?:do not|don't|stop|avoid)/i.test(action))
    return 'next_action asks to repeat the ineffective call';
}

function diagnosticNote(diagnostic: DiagnosticEvidence | undefined, stage: string, progressVersion: number): string | undefined {
  if (!diagnostic || diagnostic.stage !== stage || !diagnostic.failures.length) return;
  const label = diagnostic.progressVersion === progressVersion ? 'Last host diagnostic; no observed saved progress since' :
    'Earlier host diagnostic, before later saved changes';
  const first = conciseDiagnosticFailures(diagnostic.failures, 2).join('; ');
  return `${label} (${diagnostic.failed}/${diagnostic.total} failed): ${first}. Check the saved state before treating these mismatches as current.`;
}

export function buildWorkerDirective(input: { trigger: Trigger; diagnosis: Diagnosis; recent: readonly ToolObservation[];
  task: string; stage: string; progressVersion: number; diagnostic?: DiagnosticEvidence; source: 'model' | 'fallback' }): string {
  const { trigger, diagnosis, recent, task, stage, progressVersion, diagnostic, source } = input;
  const last = triggerObservation(trigger, recent);
  const operation = `${clean(trigger.tool, 100)} with ${argsOf(last)}`;
  const note = diagnosticNote(diagnostic, stage, progressVersion);
  const loop = isInspectionLoop(trigger);
  const noOp = trigger.type === 'T4' && !loop;
  const facts = receiptFacts(last, trigger.evidence);
  const modelAction = source === 'model' && !weakLoopAction(trigger, diagnosis, recent, task, diagnostic) ?
    clean(diagnosis.next_action, 220) : undefined;
  const alternate = alternateRead(trigger, recent, task, diagnostic);
  const pathCorrection = fileToolPathCorrection(trigger, last);
  const next = loop ? modelAction ?? alternate ?? 'Stop this loop and report the blocker; no distinct grounded read is available.' :
    noOp ? modelAction ?? alternate ?? 'Stop and report the blocker; no distinct grounded read is available.' :
      pathCorrection ?? clean(diagnosis.next_action, 220);
  const blocked = /^stop\b/i.test(next);
  const lines = [`[Pi Sitter intervention — extension generated, advisory; verify against the task]`];
  if (loop) {
    lines.push(`Stop calling ${operation} now. Its repeated identical results add no evidence. Do not call it again until a saved change or a new relevant fact exists.`);
  } else if (noOp) {
    lines.push(`Stop repeating ${operation}. ${facts.length ? `The receipt says ${facts.join(', ')}.` : 'The receipt records no saved change.'} Treat this as no persisted repair.`);
  } else {
    lines.push(`Stop retrying ${operation} without changing the approach. Use the observed failure to choose one distinct next step.`);
  }
  lines.push(`Next: ${next}`);
  if (note) lines.push(note);
  if (blocked) lines.push('State which saved evidence is missing and what prevents a safe repair.');
  else if (noOp && facts.includes('dry_run:true')) lines.push('A preview is not a saved change. If the target is still missing, make one supported persisted edit and verify its saved receipt.');
  else lines.push('Make at most one evidence-supported persisted repair at a time, then verify the saved artifact or receipt.');
  lines.push('You must carry out the original task\'s requested source repair. Do not finish with only a diagnosis or a plan: make a supported change, save it, and check the saved result. If genuinely blocked, follow the task\'s stop conditions and report the exact failed operation and remaining work.');
  if (noOp && /"value"\s*:\s*null/.test(argsOf(last))) lines.push('Do not repeat the null assignment.');
  lines.push('Inspect an existing resource before editing it in place; do not recreate or overwrite it from a failure label alone. Report unresolved evidence. A timed-out run is not a successful check. Do not edit protected tests.');
  return lines.join('\n');
}

export function conciseDiagnosticFailures(failures: readonly { id: string; detail: string }[], limit = 8): string[] {
  return [...failures].sort((a, b) => Number(/\b(?:missing|saved|container|script=|root=|not found|does not exist)\b/i.test(b.detail)) -
    Number(/\b(?:missing|saved|container|script=|root=|not found|does not exist)\b/i.test(a.detail)))
    .slice(0, limit).map(row => {
      const first = row.detail.split(/\r?\n/)[0].replace(/^\s*(?:AssertionError|Error):\s*/i, '')
        .split(/:\s*expected\b|\s*\/\/\s*Object\.is equality/i)[0];
      return `${clean(row.id, 80)}: ${clean(first, 200)}`;
    });
}
