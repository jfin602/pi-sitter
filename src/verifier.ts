import { spawn } from 'node:child_process';
import { cp, lstat, mkdtemp, realpath, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GateReport } from './gates.ts';
import type { CheckpointSelection } from './checkpoints.ts';

/** Installed by the trusted host, never loaded from the project or a model response. */
export interface ApprovedVerifier {
  id: string;
  executable: string;
  args: string[];
  sourcePath: string;
  suitePath: string;
  runtimePaths: string[];
  /** Individual host-approved runtime binaries needed by the suite (for example, an engine). */
  runtimeExecutables?: string[];
  environment?: Record<string, string>;
  timeoutMs?: number;
  taskId?: string;
  suiteDigest?: string;
  sourceSnapshot?: string;
  gateIds?: string[];
}

const MAX_OUTPUT = 1024 * 1024;
let active = 0;
const MAX_ACTIVE = 2;
const LAUNCHER = fileURLToPath(new URL('./sandbox-launcher.mjs', import.meta.url));
const absolute = (path: string): boolean => isAbsolute(path) && !path.includes('\0') && !path.split(sep).includes('..');

async function checkedPath(path: string, directory: boolean): Promise<string> {
  if (!absolute(path)) throw new Error('Verifier execution blocked: path must be absolute and traversal-free');
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()))
    throw new Error('Verifier execution blocked: path type or symlink denied');
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) throw new Error('Verifier execution blocked: path alias denied');
  return canonical;
}

async function checkedTree(root: string, check: () => void, maxEntries = 20000): Promise<void> {
  const pending = [root];
  let entries = 0, bytes = 0;
  while (pending.length) {
    check();
    const dir = pending.pop()!;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      check();
      if (++entries > maxEntries) throw new Error('Verifier execution blocked: source or suite entry limit exceeded');
      const path = join(dir, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)))
        throw new Error('Verifier execution blocked: source or suite link/special file denied');
      if (stat.isFile() && (stat.size > 64 * 1024 * 1024 || (bytes += stat.size) > 256 * 1024 * 1024))
        throw new Error('Verifier execution blocked: source or suite byte limit exceeded');
      if (stat.isDirectory()) pending.push(path);
    }
  }
}

function validatePlan(plan: ApprovedVerifier): void {
  if (!plan || typeof plan !== 'object' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(plan.id) ||
      !absolute(plan.executable) || !absolute(plan.sourcePath) || !absolute(plan.suitePath) ||
      !Array.isArray(plan.args) || plan.args.length > 32 || plan.args.some(x => typeof x !== 'string' || x.length > 2048 || x.includes('\0')) ||
      !Array.isArray(plan.runtimePaths) || plan.runtimePaths.length > 16 || plan.runtimePaths.some(x =>
        typeof x !== 'string' || !absolute(x) || !x.startsWith('/usr/lib')) ||
      (plan.runtimeExecutables !== undefined && (!Array.isArray(plan.runtimeExecutables) ||
        plan.runtimeExecutables.length > 4 || plan.runtimeExecutables.some(x => typeof x !== 'string' || !absolute(x)))) ||
      (plan.environment && (Object.keys(plan.environment).length > 32 || Object.entries(plan.environment).some(([k, v]) =>
        !/^[A-Z][A-Z0-9_]{0,63}$/.test(k) || /^(PI_SITTER_|HOME$|TMPDIR$|PATH$|LD_|NODE_OPTIONS$)/.test(k) ||
        typeof v !== 'string' || v.length > 2048 || v.includes('\0')))))
    throw new Error('Verifier execution blocked: invalid trusted execution plan');
  if (plan.timeoutMs !== undefined && (!Number.isSafeInteger(plan.timeoutMs) || plan.timeoutMs < 1 || plan.timeoutMs > 60_000))
    throw new Error('Verifier execution blocked: invalid timeout');
}

/** Legacy host setting now names a host-resolved plan; command arrays cannot grant execution. */
export function configuredVerifier(raw = process.env.PI_SITTER_VERIFY_COMMAND,
  resolveApproved?: (id: string, checkpoint?: CheckpointSelection) => ApprovedVerifier | undefined) {
  if (!raw) return undefined;
  let request: unknown;
  try { request = JSON.parse(raw); } catch { throw new Error('PI_SITTER_VERIFY_COMMAND must be a JSON plan identifier'); }
  if (typeof request !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(request))
    throw new Error('PI_SITTER_VERIFY_COMMAND must name a trusted approved verifier');
  return async (stage: string, projectRoot: string,
    options: { signal?: AbortSignal; previous?: GateReport; checkpoint?: CheckpointSelection }): Promise<unknown> => {
    const plan = resolveApproved?.(request, options.checkpoint);
    if (!plan || plan.id !== request) throw new Error('Verifier execution blocked: approved plan unavailable');
    return approvedVerifier(plan)(stage, projectRoot, options);
  };
}

export function approvedVerifier(plan: ApprovedVerifier) {
  validatePlan(plan);
  return async (stage: string, _projectRoot: string, options: { signal?: AbortSignal; previous?: GateReport;
    checkpoint?: CheckpointSelection }): Promise<unknown> => {
    if (process.platform !== 'linux') throw new Error('Verifier execution blocked: Linux bubblewrap is required');
    if (active >= MAX_ACTIVE) throw new Error('Verifier execution blocked: concurrent attempt limit');
    if (options.checkpoint && (plan.taskId !== options.checkpoint.taskId ||
        plan.suiteDigest !== options.checkpoint.suiteDigest ||
        plan.sourceSnapshot !== options.checkpoint.snapshotId ||
        !plan.gateIds || plan.gateIds.length !== options.checkpoint.gateIds.length ||
        !plan.gateIds.every(id => options.checkpoint!.gateIds.includes(id))))
      throw new Error('Verifier execution blocked: approved plan does not match checkpoint');
    active++;
    let privateRoot: string | undefined;
    const deadline = Date.now() + (plan.timeoutMs ?? 60_000);
    const check = () => {
      if (options.signal?.aborted) throw new Error('Verifier execution blocked: canceled');
      if (Date.now() >= deadline) throw new Error('Verifier execution blocked: wall-clock timeout');
    };
    try {
      check();
      const source = await checkedPath(plan.sourcePath, true);
      const suite = await checkedPath(plan.suitePath, true);
      const executable = await checkedPath(plan.executable, false);
      const launcher = await checkedPath(LAUNCHER, false);
      const node = await checkedPath(process.execPath, false);
      if (source.split(sep).filter(Boolean).length < 2 || suite.split(sep).filter(Boolean).length < 2)
        throw new Error('Verifier execution blocked: broad source or suite mount denied');
      if (source === suite || source.startsWith(suite + sep) || suite.startsWith(source + sep))
        throw new Error('Verifier execution blocked: source and suite overlap');
      if (executable.startsWith(source + sep) || executable.startsWith(suite + sep) ||
          source === resolve(_projectRoot))
        throw new Error('Verifier execution blocked: executable or source is inside the live project');
      const extraExecutables = await Promise.all((plan.runtimeExecutables ?? []).map(async path => {
        const checked = await checkedPath(path, false);
        if (checked.startsWith(source + sep) || checked.startsWith(suite + sep) ||
            checked.startsWith(resolve(_projectRoot) + sep))
          throw new Error('Verifier execution blocked: runtime executable overlaps source, suite, or live project');
        const stat = await lstat(checked);
        if (!(stat.mode & 0o111)) throw new Error('Verifier execution blocked: runtime executable is not executable');
        return checked;
      }));
      await Promise.all([checkedTree(source, check), checkedTree(suite, check)]);
      privateRoot = await mkdtemp(join(tmpdir(), `pi-sitter-view-${process.pid}-`));
      const sourceView = join(privateRoot, 'source');
      const suiteView = join(privateRoot, 'suite');
      const filter = () => { check(); return true; };
      await cp(source, sourceView, { recursive: true, force: false, errorOnExist: true, filter });
      await cp(suite, suiteView, { recursive: true, force: false, errorOnExist: true, filter });
      await Promise.all([checkedTree(sourceView, check), checkedTree(suiteView, check)]);
      const runtime = await Promise.all(plan.runtimePaths.map(async path => {
        const stat = await lstat(path);
        return checkedPath(path, stat.isDirectory());
      }));
      const sandbox = ['--die-with-parent', '--new-session', '--unshare-pid', '--unshare-net',
        '--cap-drop', 'ALL', '--clearenv', '--tmpfs', '/', '--dir', '/source', '--dir', '/suite',
        '--size', '33554432', '--tmpfs', '/scratch', '--size', '16777216', '--tmpfs', '/tmp',
        '--ro-bind', sourceView, '/source', '--ro-bind', suiteView, '/suite',
        '--proc', '/proc', '--dev', '/dev',
        '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64'];
      for (const path of [...new Set([executable, node, launcher, '/usr/bin/prlimit', ...runtime, ...extraExecutables])]) {
        const parts = path.slice(1).split('/');
        let dir = '';
        for (const part of parts.slice(0, -1)) { dir += '/' + part; sandbox.push('--dir', dir); }
        sandbox.push('--ro-bind', path, path);
      }
      sandbox.push('--setenv', 'HOME', '/scratch', '--setenv', 'TMPDIR', '/scratch',
        '--setenv', 'PI_SITTER_STAGE', stage, '--setenv', 'PI_SITTER_PROJECT_ROOT', '/source',
        '--setenv', 'PI_SITTER_SUITE_ROOT', '/suite');
      for (const [key, value] of Object.entries(plan.environment ?? {})) sandbox.push('--setenv', key, value);
      // RLIMIT_NPROC counts all threads for the host UID; 64 blocks Godot on busy hosts.
      // Keep a finite cap while CPU, memory, time, and concurrent-run limits bound the child.
      sandbox.push('--chdir', '/source', '--', '/usr/bin/prlimit', '--cpu=30', '--as=4294967296',
        '--fsize=16777216', '--nofile=128', '--nproc=4096', '--core=0', '--', node, launcher, executable, ...plan.args);
      check();
      const result = await new Promise<{ stdout: string; code: number }>((done, fail) => {
        const child = spawn('bwrap', sandbox, { env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
        let output = '', errorOutput = '', completed = false, failureReason: string | undefined;
        const stop = (reason: string) => {
          if (completed || failureReason) return;
          failureReason = reason;
          try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        };
        const timeout = setTimeout(() => stop('wall-clock timeout'), Math.max(1, deadline - Date.now()));
        const cancel = () => stop('canceled');
        options.signal?.addEventListener('abort', cancel, { once: true });
        if (options.signal?.aborted) cancel();
        child.stdout?.on('data', chunk => { output += chunk.toString(); if (output.length > MAX_OUTPUT) stop('stdout limit'); });
        child.stderr?.on('data', chunk => { errorOutput += chunk.toString(); if (errorOutput.length > MAX_OUTPUT) stop('stderr limit'); });
        child.on('error', error => stop(error.message.slice(0, 160)));
        child.on('close', (code, signal) => {
          clearTimeout(timeout);
          options.signal?.removeEventListener('abort', cancel);
          if (completed) return;
          completed = true;
          if (failureReason) return fail(new Error(`Verifier execution blocked: ${failureReason}`));
          if (signal || code === null || code > 1) return fail(new Error(`Verifier execution blocked: sandbox or runner exit ${code ?? signal}; ${errorOutput.slice(0, 160)}`));
          done({ stdout: output, code });
        });
      });
      let report: unknown;
      try { report = JSON.parse(result.stdout); } catch { throw new Error('Verifier returned malformed machine-readable report'); }
      if (!report || typeof report !== 'object' || Array.isArray(report) ||
          (report as { execution?: { exitCode?: number } }).execution?.exitCode !== result.code)
        throw new Error('Verifier exit status disagrees with machine-readable report');
      return report;
    } finally {
      try {
        if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
      } finally { active--; }
    }
  };
}
