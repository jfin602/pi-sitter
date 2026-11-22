# Contract — Supervisor Research and MCP Tool Policy

**Status:** P5 host-reviewed proxy implemented for embedding hosts that supply a vetted dispatcher and independent connected-server identity. The ordinary standalone extension has no such host adapter, so direct MCP remains unavailable there; snapshot inspection remains available. Native model-driven MCP qualification is still open.

## Capability rules

1. Discover available worker MCP servers and capabilities through trusted Pi host APIs, but do not blindly copy worker permissions into the supervisor.
2. Classify **each operation and arguments** for direct and indirect side effects. Only inspected and approved read-only capabilities may be exposed.
3. Deny by default: unknown tools, write/edit/delete, command/shell execution, config mutation, test editing, commits/pushes, arbitrary network mutations, and nominal “read” tools that can trigger writes/leak secrets.
4. Enforce policy in the host/tool layer before tool dispatch. Model instructions are supplemental only.
5. Prevent confused-deputy escalation via nested tools/resources, prompts that request indirect mutations, user-provided project text, and tool return values.
6. Bounded reads and snapshot/source identity apply; preserve evidence provenance and inspect only task-related resources.
7. Approved isolated tests are separate from model MCP tools. A runner may write disposable scratch artifacts without giving Pi Sitter filesystem write authority.

## Current boundary

`src/supervisor-session.ts` always permits `pi_sitter_inspect` and still rejects name-only `allowedMcpTools` and `prepare`. A trusted embedding host may supply exact operation reviews through `mcpReadHost`: connected-server identity, Pi tool source path and schema digest, argument/resource authorization, a dedicated dispatcher and result screening. Only then does the child session register `pi_sitter_mcp_read`. Pi's `getAllTools()` metadata is checked again at each dispatch. The child loads no worker MCP extension, codemode, shell or write tool. Unknown or changed operations fail closed. Denied and error results are not diagnosis evidence.

Pi 1.5.2 does not provide an extension API to invoke a worker MCP tool outside a worker tool execution, and `getAllTools()` does not expose the built-in MCP connection's config source or endpoint. `getMcpServers()` covers extension registrations, not all `mcp.json` connections. The embedding host therefore must independently attest the connected server and provide a separately constrained client/dispatcher. The shipped extension does not infer this identity from names, annotations or project configuration. A host that cannot attest it gets an explicit unavailable reason and only snapshot inspection.

## Qualification

Test allowed file/source/git/document reads, refused write/edit/shell commands, argument-level mutation traps, indirect MCP tool chaining, symlink/secret path access, stale snapshot, malicious untrusted evidence, resource/time budgets, and preserved worker functionality. Record each attempted capability and observed denial.

## Audited Pi 1.5.2 feasibility and evidence custody

Pi 1.5.2 `getAllTools()` exposes declared tool metadata and `getActiveTools()` exposes model-visible declarations; changing active tools does **not** prove revoked nested/deferred/codemode calls. MCP `readOnlyHint` is server-authored, not a verified permission boundary. SDK sessions require explicit MCP extension loading. See [SDK types](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/src/core/extensions/types.ts#L1814-L1827) and [MCP docs](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/mcp.md#L252-L274).

Discover worker declarations through Pi's host API and connected-server identity through a trusted host facility. Classify each **operation + arguments + resource + nested route**; deny unknown/side-effecting capabilities before dispatch. Record allowed, denied and failed calls with task, tool, bounded args/result digests and source identity; the resource identifier is recorded as a digest. Worker permissions remain independent. The controlled Pi/MCP fixture proves the host-dispatch read and denial path. It does not establish a general-purpose adapter for arbitrary configured services or a live model-driven supervisor run; those remain qualification gaps. Restricted broker inspection is the safe fallback.

Keep current broker path/link/file count/byte/digest protections, and add **capture-time** wall-clock/output/byte limits, actual copied-content validation, provider scope restrictions and provenance-bound receipts. Stale/unrelated/provider-error evidence cannot authorize a causal diagnosis. [Audit A07/A08](../tasks/p1/codebase-gap-audit.md).
