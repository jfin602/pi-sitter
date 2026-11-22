import { createHash } from 'node:crypto';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

type WorkerTool = ReturnType<ExtensionAPI['getAllTools']>[number];
const MAX_ARGS = 4096;
const MAX_RESULT = 16000;
const MAX_CALLS = 20;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

/** A host-owned operation review. Neither MCP annotations nor model text can create one. */
export interface VettedMcpRead {
  name: string;
  /** Host attestation of the connected server and its configuration source. */
  serverIdentity: string;
  /** Exact Pi source path and schema identity approved by the embedding host. */
  sourcePath: string;
  schemaDigest: string;
  /** Exact canonical resource identifiers approved for this task and gate. */
  resourceScopes: readonly string[];
  /** Resolve and authorize the concrete resource and every argument before execution. */
  authorize(args: Record<string, unknown>, identity: { taskId: string; sourceIdentity: string }):
    Promise<{ resource: string; args: Record<string, unknown> }>;
  /** Host-owned, operation-specific dispatcher. Must not invoke a generic model-selected tool route. */
  execute(args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
  /** Host-owned result screening, including credentials and resource links. */
  sanitize(result: unknown): string;
}

export interface McpReadReceipt {
  taskId: string;
  turnId: string;
  sourceIdentity: string;
  tool: string;
  sourcePath?: string;
  serverDigest?: string;
  resourceDigest?: string;
  argsDigest: string;
  resultDigest?: string;
  timestamp: string;
  evidenceRef?: string;
  status: 'allowed' | 'denied' | 'error';
  reason?: string;
}

export interface McpReadHost {
  taskId: string;
  turnId: string;
  sourceIdentity: string;
  /** Pi's worker metadata must be read afresh at dispatch; this does not change worker access. */
  getWorkerTools(): WorkerTool[];
  /** Pi getAllTools does not expose the mcp.json connection/source identity. */
  getWorkerServerIdentity(name: string): string | undefined;
  operations: readonly VettedMcpRead[];
  record(receipt: McpReadReceipt): void;
}

export function mcpSchemaDigest(schema: unknown): string { return sha(JSON.stringify(schema)); }
function canonicalResource(value: string): boolean {
  try { return new URL(value).href === value; } catch { return false; }
}

function matchingTool(host: McpReadHost, operation: VettedMcpRead): WorkerTool | undefined {
  const matches = host.getWorkerTools().filter(tool => tool.name === operation.name);
  if (matches.length !== 1) return undefined;
  const tool = matches[0];
  if (!tool.name.startsWith('mcp__') || tool.sourceInfo.path !== operation.sourcePath ||
      !operation.serverIdentity || typeof host.getWorkerServerIdentity !== 'function' ||
      host.getWorkerServerIdentity(operation.name) !== operation.serverIdentity ||
      mcpSchemaDigest(tool.parameters) !== operation.schemaDigest || tool.exposure === 'hidden') return undefined;
  return tool;
}

export function discoverMcpReads(host: McpReadHost): { allowed: string[]; unavailable: Record<string, string> } {
  const allowed: string[] = [], unavailable: Record<string, string> = {};
  for (const tool of host.getWorkerTools()) {
    if ((tool.name.startsWith('mcp__') || ['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource'].includes(tool.name)) &&
        !host.operations.some(operation => operation.name === tool.name))
      unavailable[tool.name] = 'no host-vetted operation policy';
  }
  for (const operation of host.operations) {
    if (host.operations.filter(candidate => candidate.name === operation.name).length !== 1) {
      unavailable[operation.name] = 'duplicate host policy';
    } else if (!matchingTool(host, operation)) {
      unavailable[operation.name] = 'worker tool, source, schema, or exposure mismatch';
    } else if (!Array.isArray(operation.resourceScopes) || !operation.resourceScopes.length ||
      operation.resourceScopes.some(scope => typeof scope !== 'string' || !canonicalResource(scope)) ||
      typeof operation.authorize !== 'function' || typeof operation.execute !== 'function' ||
      typeof operation.sanitize !== 'function') {
      unavailable[operation.name] = 'incomplete host operation review';
    } else {
      allowed.push(operation.name);
    }
  }
  return { allowed, unavailable };
}

/** The only route from a supervisor tool call to a host-vetted MCP operation. */
export class McpReadDispatcher {
  private calls = 0;
  private readonly host: McpReadHost;
  constructor(host: McpReadHost) { this.host = host; }

  async dispatch(name: string, raw: unknown, signal?: AbortSignal): Promise<string> {
    let argsDigest = sha('[invalid]');
    let sourcePath: string | undefined;
    let serverDigest: string | undefined;
    let resourceDigest: string | undefined;
    let phase: 'policy' | 'execute' = 'policy';
    const receipt = (status: McpReadReceipt['status'], reason?: string, resultDigest?: string) => {
      this.host.record({ taskId: this.host.taskId, turnId: this.host.turnId, sourceIdentity: this.host.sourceIdentity,
        tool: name.slice(0, 128), sourcePath, serverDigest, resourceDigest, argsDigest, resultDigest,
        timestamp: new Date().toISOString(), evidenceRef: status === 'allowed' ? resultDigest : undefined, status, reason });
    };
    try {
      const serialized = JSON.stringify(raw);
      if (!serialized || serialized.length > MAX_ARGS || !raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('invalid or oversized arguments');
      argsDigest = sha(serialized);
      const operation = this.host.operations.find(candidate => candidate.name === name);
      if (!operation || !matchingTool(this.host, operation) || !Array.isArray(operation.resourceScopes) ||
          !operation.resourceScopes.length ||
          this.host.operations.filter(candidate => candidate.name === name).length !== 1)
        throw new Error('operation unavailable: no matching vetted worker MCP capability');
      sourcePath = operation.sourcePath;
      serverDigest = sha(operation.serverIdentity);
      if (++this.calls > MAX_CALLS) throw new Error('MCP read call limit reached');
      if (signal?.aborted) throw new Error('MCP read canceled');
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), 15_000);
      const canceled = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('MCP read canceled or timed out')), { once: true });
      });
      try {
        const resolved = await Promise.race([operation.authorize(raw as Record<string, unknown>,
          { taskId: this.host.taskId, sourceIdentity: this.host.sourceIdentity }), canceled]);
        if (!resolved || typeof resolved.resource !== 'string' || !resolved.resource ||
            !resolved.args || typeof resolved.args !== 'object' || Array.isArray(resolved.args) ||
            JSON.stringify(resolved.args).length > MAX_ARGS)
          throw new Error('host did not resolve an approved resource');
        if (!canonicalResource(resolved.resource) ||
            !operation.resourceScopes.includes(resolved.resource)) throw new Error('resource outside approved scope');
        resourceDigest = sha(resolved.resource);
        phase = 'execute';
        const result = await Promise.race([operation.execute(resolved.args, controller.signal), canceled]);
        if (result && typeof result === 'object' && 'isError' in result && result.isError === true)
          throw new Error('MCP server returned an error');
        const text = operation.sanitize(result);
        if (typeof text !== 'string' || text.length > MAX_RESULT) throw new Error('MCP read result unavailable or oversized');
        receipt('allowed', undefined, sha(text));
        return text;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
    } catch (error) {
      const reason = phase === 'policy' ? 'MCP read denied by host policy' : 'MCP read failed or timed out';
      receipt(phase === 'policy' ? 'denied' : 'error', reason);
      throw new Error(reason);
    }
  }
}
