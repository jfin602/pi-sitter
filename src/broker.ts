import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, open, readdir, realpath, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export interface EvidenceRequest { capability: string; path?: string; validator?: string }
export interface EvidenceResult { capability: string; path?: string; ok: boolean; trust: 'untrusted_project_evidence'; evidence?: unknown; error?: string; receipt?: InspectionReceipt }
export interface InspectionReceipt { taskId: string; turnId: string; tool: string; operation: string; argsDigest: string;
  sourceIdentity: string; timestamp: string; status: 'allowed' | 'denied' | 'error'; resultDigest?: string; evidenceRef?: string }
export interface ProbeFact { result: 'PASS' | 'FAIL' | 'UNVERIFIED'; evidence: string }
export interface ProbeOutput { facts: Record<string, ProbeFact>; errors: string[] }
export interface SnapshotResult { identity: string; probe: ProbeOutput; files: number }
export interface EvidenceSnapshot {
  /** Internal provider workspace; never exposed as a model tool argument. */
  root: string;
  identity: string;
  files: number;
  inspect(requests: unknown, signal?: AbortSignal): Promise<EvidenceResult[]>;
  close(): Promise<void>;
}
export interface EvidenceProvider {
  readonly capabilities: ReadonlySet<string>;
  /** Host-owned resource allowlist. A path is either an exact file or a directory prefix ending in /. */
  readonly resourceScopes: Readonly<Record<string, readonly string[]>>;
  /** Select saved project files before they enter an isolated byte-copy. */
  acceptSnapshotPath(relativePath: string, isDirectory: boolean, size: number): boolean;
  inspect(snapshotRoot: string, request: EvidenceRequest, signal?: AbortSignal): Promise<EvidenceResult>;
  validate(snapshotRoot: string, signal?: AbortSignal): Promise<ProbeOutput>;
}

const MAX_REQUESTS = 8;
const MAX_RETURN = 64_000;
const MAX_SNAPSHOT = 50_000_000;
const MAX_FILE = 2_000_000;
const MAX_FILES = 5_000;
const MAX_TIME = 35_000;
const MAX_CAPTURE_TIME = 35_000;
const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

/** Framework-neutral permissions, snapshot isolation, limits, and provider routing. */
export class EvidenceBroker {
  private readonly root: string;
  private readonly provider: EvidenceProvider;
  /** Bounded metadata only; caller may persist these with its task ledger. */
  readonly receipts: InspectionReceipt[] = [];
  constructor(projectRoot: string, provider: EvidenceProvider) { this.root = resolve(projectRoot); this.provider = provider; }

  private validateRequest(raw: unknown): EvidenceRequest {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid inspection request');
    const value = raw as Record<string, unknown>;
    if (Object.keys(value).some(key => !['capability', 'path', 'validator'].includes(key))) throw new Error('unsupported inspection argument');
    if (typeof value.capability !== 'string' || !this.provider.capabilities.has(value.capability)) throw new Error('forbidden capability');
    if (value.path !== undefined && (typeof value.path !== 'string' || !value.path || isAbsolute(value.path) ||
      value.path.includes('\\') || value.path.includes('\0') || value.path.split('/').some(part => !part || part === '.' || part === '..')))
      throw new Error('path traversal or invalid path');
    if (value.validator !== undefined && (typeof value.validator !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(value.validator)))
      throw new Error('invalid validator');
    return value as unknown as EvidenceRequest;
  }

  private async capture(signal?: AbortSignal): Promise<{ root: string; identity: string; files: number }> {
    const sourceRoot = await realpath(this.root);
    const targetRoot = await mkdtemp(join(tmpdir(), 'pi-sitter-evidence-'));
    let bytes = 0, files = 0;
    const deadline = performance.now() + MAX_CAPTURE_TIME;
    const check = () => {
      if (signal?.aborted) throw signal.reason ?? new Error('inspection aborted');
      if (performance.now() > deadline) throw new Error('snapshot capture time limit');
    };
    const digest = createHash('sha256');
    try {
      const visit = async (dir: string, prefix = ''): Promise<void> => {
        check();
        for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
          check();
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
          const source = join(dir, entry.name);
          const info = await lstat(source);
          if (!this.provider.acceptSnapshotPath(relative, info.isDirectory(), info.size)) continue;
          const scopes = Object.values(this.provider.resourceScopes ?? {}).flat();
          const inScope = scopes.some(scope => scope === relative ||
            (scope.endsWith('/') && relative.startsWith(scope)) ||
            (info.isDirectory() && (scope.startsWith(`${relative}/`) || scope === `${relative}/`)));
          if (!inScope) continue;
          if (info.isSymbolicLink()) throw new Error(`snapshot rejects symlink: ${relative}`);
          if (info.isDirectory()) { await visit(source, relative); continue; }
          if (!info.isFile()) continue;
          if (info.nlink > 1) throw new Error(`snapshot rejects hard link: ${relative}`);
          if (info.size > MAX_FILE) throw new Error(`snapshot file too large: ${relative}`);
          if (++files > MAX_FILES) throw new Error('snapshot file count limit');
          const target = join(targetRoot, relative);
          await mkdir(dirname(target), { recursive: true });
          const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
          try {
            const before = await input.stat();
            if (!before.isFile() || before.nlink > 1 || before.dev !== info.dev || before.ino !== info.ino || before.size > MAX_FILE)
              throw new Error(`snapshot source changed: ${relative}`);
            const output = await open(target, 'wx');
            const sourceHash = createHash('sha256');
            let copied = 0;
            try {
              const chunk = Buffer.allocUnsafe(64 * 1024);
              while (true) {
                check();
                const { bytesRead } = await input.read(chunk, 0, chunk.length, null);
                check();
                if (!bytesRead) break;
                copied += bytesRead;
                bytes += bytesRead;
                if (copied > MAX_FILE || bytes > MAX_SNAPSHOT) throw new Error('snapshot byte limit');
                sourceHash.update(chunk.subarray(0, bytesRead));
                let offset = 0;
                while (offset < bytesRead) {
                  check();
                  const written = await output.write(chunk, offset, bytesRead - offset);
                  if (!written.bytesWritten) throw new Error('snapshot copy failed');
                  offset += written.bytesWritten;
                }
              }
            } finally { await output.close(); }
            const after = await input.stat();
            const pathAfter = await lstat(source);
            if (copied !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
                before.ctimeMs !== after.ctimeMs || after.ino !== pathAfter.ino || after.dev !== pathAfter.dev)
              throw new Error(`snapshot source changed: ${relative}`);
            const copiedFile = await open(target, 'r');
            const copyHash = createHash('sha256');
            try {
              const chunk = Buffer.allocUnsafe(64 * 1024);
              while (true) { check(); const { bytesRead } = await copiedFile.read(chunk, 0, chunk.length, null);
                if (!bytesRead) break; copyHash.update(chunk.subarray(0, bytesRead)); }
            } finally { await copiedFile.close(); }
            const sourceDigest = sourceHash.digest('hex');
            if (sourceDigest !== copyHash.digest('hex')) throw new Error(`snapshot copy mismatch: ${relative}`);
            digest.update(relative).update('\0').update(sourceDigest).update('\0');
          } finally { await input.close(); }
        }
      };
      await visit(sourceRoot);
      check();
      if (files === 0) throw new Error('snapshot has no project files');
      return { root: targetRoot, identity: digest.digest('hex'), files };
    } catch (error) { await rm(targetRoot, { recursive: true, force: true }); throw error; }
  }

  private async runRequests(snapshotRoot: string, requests: unknown, signal?: AbortSignal,
    context?: { taskId: string; turnId: string; sourceIdentity: string }): Promise<EvidenceResult[]> {
    if (!Array.isArray(requests) || requests.length === 0 || requests.length > MAX_REQUESTS) throw new Error('invalid inspection request count');
    const validated = requests.map(raw => this.validateRequest(raw));
    const started = performance.now();
    let bytes = 0;
    const results: EvidenceResult[] = [];
    for (const request of validated) {
      try {
      if (signal?.aborted) throw signal.reason ?? new Error('inspection aborted');
      const scopes = this.provider.resourceScopes?.[request.capability];
      if (!request.path || !scopes?.some(scope => request.path === scope ||
          (scope.endsWith('/') && request.path!.startsWith(scope)))) throw new Error('inspection resource outside approved scope');
      const canonical = await realpath(join(snapshotRoot, request.path));
      if (!canonical.startsWith(`${snapshotRoot}/`)) throw new Error('inspection alias escape');
      const remaining = MAX_TIME - (performance.now() - started);
      if (remaining <= 0) throw new Error('inspection time limit');
      const result = await this.bounded(boundedSignal => this.provider.inspect(snapshotRoot, request, boundedSignal), remaining, signal);
      if (!result || result.capability !== request.capability || result.path !== request.path ||
          result.trust !== 'untrusted_project_evidence' || typeof result.ok !== 'boolean' ||
          (result.ok && (result.error !== undefined || result.evidence === undefined)))
        throw new Error('inspection result missing provenance');
      bytes += JSON.stringify(result).length;
      if (bytes > MAX_RETURN) throw new Error('total evidence output limit');
      if (context) result.receipt = { taskId: context.taskId, turnId: context.turnId, tool: 'pi_sitter_inspect',
        operation: request.capability, argsDigest: hash(JSON.stringify(request)), sourceIdentity: context.sourceIdentity,
        timestamp: new Date().toISOString(), status: result.ok ? 'allowed' : 'error',
        resultDigest: result.ok ? hash(JSON.stringify(result.evidence)) : undefined,
        evidenceRef: result.ok ? `${context.sourceIdentity}:${request.path}` : undefined };
      if (result.receipt) this.receipts.push(result.receipt);
      results.push(result);
      } catch (error) {
        if (context) this.receipts.push({ taskId: context.taskId, turnId: context.turnId,
          tool: 'pi_sitter_inspect', operation: request.capability, argsDigest: hash(JSON.stringify(request)),
          sourceIdentity: context.sourceIdentity, timestamp: new Date().toISOString(),
          status: error instanceof Error && /scope|alias/.test(error.message) ? 'denied' : 'error' });
        throw error;
      }
    }
    return results;
  }

  private async bounded<T>(action: (boundedSignal: AbortSignal) => Promise<T>, milliseconds: number, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw signal.reason ?? new Error('inspection aborted');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { const error = new Error('inspection time limit'); controller.abort(error); reject(error); }, milliseconds);
      if (signal) {
        onAbort = () => { const error = signal.reason ?? new Error('inspection aborted'); controller.abort(error); reject(error); };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
    try { return await Promise.race([action(controller.signal), limit]); }
    finally { if (timer) clearTimeout(timer); if (signal && onAbort) signal.removeEventListener('abort', onAbort); }
  }

  async executeRequests(requests: unknown, signal?: AbortSignal): Promise<EvidenceResult[]> {
    const snapshot = await this.capture(signal);
    try { return await this.runRequests(snapshot.root, requests, signal); }
    finally { await rm(snapshot.root, { recursive: true, force: true }); }
  }

  async inspectSnapshot(identity: string, requests: unknown, signal?: AbortSignal,
    context?: { taskId: string; turnId: string }): Promise<EvidenceResult[]> {
    const snapshot = await this.capture(signal);
    try {
      if (snapshot.identity !== identity) throw new Error('project changed since verification snapshot');
      return await this.runRequests(snapshot.root, requests, signal,
        context && { ...context, sourceIdentity: snapshot.identity });
    } finally { await rm(snapshot.root, { recursive: true, force: true }); }
  }

  /** Hold one immutable byte-copy while an independent supervisor investigates it. */
  async openSnapshot(signal?: AbortSignal, context?: { taskId: string; turnId: string }): Promise<EvidenceSnapshot> {
    const snapshot = await this.capture(signal);
    let closed = false;
    return {
      root: snapshot.root,
      identity: snapshot.identity,
      files: snapshot.files,
      inspect: (requests, inspectionSignal) => {
        if (closed) throw new Error('snapshot closed');
        return this.runRequests(snapshot.root, requests, inspectionSignal,
          context && { ...context, sourceIdentity: snapshot.identity });
      },
      close: async () => { if (!closed) { closed = true; await rm(snapshot.root, { recursive: true, force: true }); } },
    };
  }

  async runValidator(signal?: AbortSignal): Promise<SnapshotResult> {
    const snapshot = await this.capture(signal);
    try { return { identity: snapshot.identity, files: snapshot.files, probe: await this.bounded(boundedSignal => this.provider.validate(snapshot.root, boundedSignal), MAX_TIME, signal) }; }
    finally { await rm(snapshot.root, { recursive: true, force: true }); }
  }
}
