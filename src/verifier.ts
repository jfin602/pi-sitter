import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GateReport } from './gates.ts';

const execFileAsync = promisify(execFile);

/** Host-owned command, never read from a project file or model output. */
export function configuredVerifier(raw = process.env.PI_SITTER_VERIFY_COMMAND) {
  if (!raw) return undefined;
  let command: unknown;
  try { command = JSON.parse(raw); } catch { throw new Error('PI_SITTER_VERIFY_COMMAND must be a JSON string array'); }
  if (!Array.isArray(command) || command.length === 0 || command.length > 16 ||
    command.some(part => typeof part !== 'string' || !part || part.length > 1000) ||
    !command[0].startsWith('/')) throw new Error('PI_SITTER_VERIFY_COMMAND requires an absolute executable and bounded arguments');
  const [file, ...args] = command as string[];
  return async (stage: string, projectRoot: string, options: { signal?: AbortSignal; previous?: GateReport }): Promise<GateReport> => {
    const sandbox = ['--ro-bind', '/', '/', '--tmpfs', '/tmp', '--ro-bind', projectRoot, projectRoot,
      '--dev-bind', '/dev', '/dev',
      '--proc', '/proc', '--unshare-net', '--clearenv', '--setenv', 'PATH', '/usr/bin:/bin',
      '--setenv', 'HOME', '/tmp', '--setenv', 'PI_SITTER_STAGE', stage,
      '--setenv', 'PI_SITTER_PROJECT_ROOT', projectRoot, '--chdir', projectRoot, '--', file, ...args];
    const { stdout } = await execFileAsync('bwrap', sandbox, {
      signal: options.signal, timeout: 60_000, maxBuffer: 2_000_000,
      env: { PATH: process.env.PATH },
    });
    const report: unknown = JSON.parse(stdout);
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Verifier returned no report');
    const value = report as Record<string, unknown>;
    if (value.schemaVersion !== 1 || value.stage !== stage || !Array.isArray(value.gates) ||
      !value.gates.length || !value.counts || typeof value.counts !== 'object' ||
      typeof value.snapshotIdentity !== 'string' || !Array.isArray(value.regressions) ||
      !Array.isArray(value.missingDeliverables) || !Array.isArray(value.validationLimitations))
      throw new Error('Verifier returned an invalid GateReport');
    return report as GateReport;
  };
}
