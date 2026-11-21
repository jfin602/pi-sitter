import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export interface EvidenceRequest { capability: string; path?: string; validator?: string }
export interface EvidenceResult { capability: string; path?: string; ok: boolean; trust: 'untrusted_project_evidence'; evidence?: unknown; error?: string }
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
const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

/** Framework-neutral permissions, snapshot isolation, limits, and provider routing. */
export class EvidenceBroker {
  private readonly root: string;
  private readonly provider: EvidenceProvider;
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
    const digest = createHash('sha256');
    try {
      const visit = async (dir: string, prefix = ''): Promise<void> => {
        for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
          if (signal?.aborted) throw signal.reason ?? new Error('inspection aborted');
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
          const source = join(dir, entry.name);
          const info = await lstat(source);
          if (!this.provider.acceptSnapshotPath(relative, info.isDirectory(), info.size)) continue;
          if (info.isSymbolicLink()) throw new Error(`snapshot rejects symlink: ${relative}`);
          if (info.isDirectory()) { await visit(source, relative); continue; }
          if (!info.isFile()) continue;
          if (info.nlink > 1) throw new Error(`snapshot rejects hard link: ${relative}`);
          if (info.size > MAX_FILE) throw new Error(`snapshot file too large: ${relative}`);
          bytes += info.size;
          if (bytes > MAX_SNAPSHOT) throw new Error('snapshot size limit');
          const data = await readFile(source);
          const target = join(targetRoot, relative);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, data, { flag: 'wx' });
          digest.update(relative).update('\0').update(hash(data)).update('\0');
          files++;
          if (files > MAX_FILES) throw new Error('snapshot file count limit');
        }
      };
      await visit(sourceRoot);
      if (files === 0) throw new Error('snapshot has no project files');
      return { root: targetRoot, identity: digest.digest('hex'), files };
    } catch (error) { await rm(targetRoot, { recursive: true, force: true }); throw error; }
  }

  private async runRequests(snapshotRoot: string, requests: unknown, signal?: AbortSignal): Promise<EvidenceResult[]> {
    if (!Array.isArray(requests) || requests.length === 0 || requests.length > MAX_REQUESTS) throw new Error('invalid inspection request count');
    const validated = requests.map(raw => this.validateRequest(raw));
    const started = performance.now();
    let bytes = 0;
    const results: EvidenceResult[] = [];
    for (const request of validated) {
      if (signal?.aborted) throw signal.reason ?? new Error('inspection aborted');
      const remaining = MAX_TIME - (performance.now() - started);
      if (remaining <= 0) throw new Error('inspection time limit');
      const result = await this.bounded(boundedSignal => this.provider.inspect(snapshotRoot, request, boundedSignal), remaining, signal);
      bytes += JSON.stringify(result).length;
      if (bytes > MAX_RETURN) throw new Error('total evidence output limit');
      results.push(result);
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

  async inspectSnapshot(identity: string, requests: unknown, signal?: AbortSignal): Promise<EvidenceResult[]> {
    const snapshot = await this.capture(signal);
    try {
      if (snapshot.identity !== identity) throw new Error('project changed since verification snapshot');
      return await this.runRequests(snapshot.root, requests, signal);
    } finally { await rm(snapshot.root, { recursive: true, force: true }); }
  }

  /** Hold one immutable byte-copy while an independent supervisor investigates it. */
  async openSnapshot(signal?: AbortSignal): Promise<EvidenceSnapshot> {
    const snapshot = await this.capture(signal);
    let closed = false;
    return {
      root: snapshot.root,
      identity: snapshot.identity,
      files: snapshot.files,
      inspect: (requests, inspectionSignal) => {
        if (closed) throw new Error('snapshot closed');
        return this.runRequests(snapshot.root, requests, inspectionSignal);
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
