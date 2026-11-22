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
  return async (stage: string, projectRoot: string, options: { signal?: AbortSignal; previous?: GateReport }): Promise<unknown> => {
    const sandbox = ['--ro-bind', '/', '/', '--tmpfs', '/tmp', '--ro-bind', projectRoot, projectRoot,
      '--dev-bind', '/dev', '/dev',
      '--proc', '/proc', '--unshare-net', '--clearenv', '--setenv', 'PATH', '/usr/bin:/bin',
      '--setenv', 'HOME', '/tmp', '--setenv', 'PI_SITTER_STAGE', stage,
      '--setenv', 'PI_SITTER_PROJECT_ROOT', projectRoot, '--chdir', projectRoot, '--', file, ...args];
    let stdout: string;
    let exitCode = 0;
    try {
      ({ stdout } = await execFileAsync('bwrap', sandbox, {
        signal: options.signal, timeout: 60_000, maxBuffer: 2_000_000,
        env: { PATH: process.env.PATH },
      }));
    } catch (error) {
      const failure = error as Error & { code?: number | string; signal?: string; killed?: boolean; stdout?: string };
      if (options.signal?.aborted || failure.killed || failure.signal || !Number.isSafeInteger(failure.code) ||
          (failure.code as number) <= 0 || (failure.code as number) > 255)
        throw new Error(`Verifier execution blocked: ${failure.message.slice(0, 200)}`);
      exitCode = failure.code as number;
      stdout = failure.stdout ?? '';
    }
    if (stdout.length > 1024 * 1024) throw new Error('Verifier report is oversized');
    let report: unknown;
    try { report = JSON.parse(stdout); } catch { throw new Error('Verifier returned malformed machine-readable report'); }
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Verifier returned no report');
    const value = report as Record<string, unknown>;
    if (!value.execution || typeof value.execution !== 'object' ||
        (value.execution as Record<string, unknown>).exitCode !== exitCode)
      throw new Error('Verifier exit status disagrees with machine-readable report');
    return report;
  };
}
