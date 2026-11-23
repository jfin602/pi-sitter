import type { TestDiscovery } from './test-discovery.ts';

export interface VerificationReadiness {
  status: 'READY' | 'CONFIGURED' | 'UNAVAILABLE' | 'NO_TESTS' | 'BLOCKED';
  candidate: TestDiscovery;
  planId?: string;
  missing: string[];
  summary: string;
}

export interface TestCommandNotice {
  status: string;
  summary: string;
  warning: boolean;
}

/** Startup reports command discovery; final validation has its own evidence status. */
export function testCommandNotice(readiness: VerificationReadiness): TestCommandNotice {
  if (readiness.status === 'BLOCKED')
    return { status: 'SETUP BLOCKED', summary: readiness.summary, warning: true };
  if (readiness.candidate.kind === 'candidate') {
    const candidate = readiness.candidate;
    return { status: 'TEST COMMAND FOUND',
      summary: `Found ${candidate.command}${candidate.tool ? ` (${candidate.tool})` : ''} in ${candidate.source}. Command discovery does not run tests.`,
      warning: false };
  }
  if (readiness.status === 'READY')
    return { status: 'HOST TEST PLAN READY', summary: 'The host has an approved test plan ready for final validation.', warning: false };
  if (readiness.candidate.kind === 'unknown')
    return { status: 'TEST COMMAND UNKNOWN', summary: `Could not determine the project test command: ${readiness.candidate.reason}.`, warning: true };
  return { status: 'NO TEST COMMAND', summary: 'No project test command found. Use /sitter status to inspect test setup.', warning: true };
}

export interface VerificationReadinessInput {
  candidate: TestDiscovery;
  controller: boolean;
  verifier: boolean;
  requirementReview: boolean;
  planId?: string;
  /** Host-owned preflight of plan, source snapshot and suite identity. */
  hostCheck?: { ready: boolean; reason?: string };
  configurationError?: string;
}

export function approvedPlanId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value))
    throw new Error('Approved verifier plan ID must be 1–128 letters, digits, dots, underscores, colons or dashes');
  return value;
}

export function configuredPlanId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('PI_SITTER_VERIFY_COMMAND must be a JSON plan identifier'); }
  return approvedPlanId(value);
}

export function assessVerificationReadiness(input: VerificationReadinessInput): VerificationReadiness {
  const missing: string[] = [];
  if (!input.controller) missing.push('trusted controller inventory');
  if (!input.verifier) missing.push('approved isolated verifier');
  if (!input.requirementReview) missing.push('independent requirement review');
  if (input.hostCheck && !input.hostCheck.ready)
    missing.push(input.hostCheck.reason?.slice(0, 180) || 'host preflight');
  const candidate = input.candidate.kind === 'candidate' ?
    `Discovered ${input.candidate.command}${input.candidate.tool ? ` (${input.candidate.tool})` : ''} in ${input.candidate.source}; it is informational and was not approved.` :
    input.candidate.kind === 'none' ? 'No project test command found.' :
      `Project test discovery is uncertain: ${input.candidate.reason}.`;
  const status: VerificationReadiness['status'] = input.configurationError ? 'BLOCKED' :
    missing.length ? input.candidate.kind === 'none' && !input.controller && !input.verifier ? 'NO_TESTS' : 'UNAVAILABLE' :
      input.hostCheck?.ready ? 'READY' : 'CONFIGURED';
  const summary = status === 'READY' ? `Protected verification ready${input.planId ? ` with plan ${input.planId}` : ''}. ${candidate}` :
    status === 'CONFIGURED' ? `Verifier callbacks are configured; host preflight has not attested the plan and source. ${candidate}` :
      status === 'BLOCKED' ? `Verification configuration blocked: ${input.configurationError!.slice(0, 180)}. ${candidate}` :
        status === 'NO_TESTS' ? `No-tests mode; completion remains UNVERIFIED. ${candidate}` :
          `Protected verification unavailable: missing ${missing.join(', ')}. ${candidate} Use /sitter status for details.`;
  return { status, candidate: input.candidate, planId: input.planId, missing, summary };
}
