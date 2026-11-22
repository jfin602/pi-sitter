# Contract — Supervisor Research and MCP Tool Policy

**Status:** Owner Q5/Q6 approved; worker-equivalent MCP discovery **NOT YET IMPLEMENTED**.

## Capability rules

1. Discover available worker MCP servers and capabilities through trusted Pi host APIs, but do not blindly copy worker permissions into the supervisor.
2. Classify **each operation and arguments** for direct and indirect side effects. Only inspected and approved read-only capabilities may be exposed.
3. Deny by default: unknown tools, write/edit/delete, command/shell execution, config mutation, test editing, commits/pushes, arbitrary network mutations, and nominal “read” tools that can trigger writes/leak secrets.
4. Enforce policy in the host/tool layer before tool dispatch. Model instructions are supplemental only.
5. Prevent confused-deputy escalation via nested tools/resources, prompts that request indirect mutations, user-provided project text, and tool return values.
6. Bounded reads and snapshot/source identity apply; preserve evidence provenance and inspect only task-related resources.
7. Approved isolated tests are separate from model MCP tools. A runner may write disposable scratch artifacts without giving Pi Sitter filesystem write authority.

## Current boundary

`src/supervisor-session.ts` permits only `pi_sitter_inspect` and rejects direct `allowedMcpTools`; `src/broker.ts` has provider capability lists and bounded snapshot copies. Do not claim MCP parity while this remains so. No tool should be enabled until a safe adapter is actually reviewed and tested.

## Qualification

Test allowed file/source/git/document reads, refused write/edit/shell commands, argument-level mutation traps, indirect MCP tool chaining, symlink/secret path access, stale snapshot, malicious untrusted evidence, resource/time budgets, and preserved worker functionality. Record each attempted capability and observed denial.

## Audited Pi 1.5.2 feasibility and evidence custody

Pi 1.5.2 `getAllTools()` exposes declared tool metadata and `getActiveTools()` exposes model-visible declarations; changing active tools does **not** prove revoked nested/deferred/codemode calls. MCP `readOnlyHint` is server-authored, not a verified permission boundary. SDK sessions require explicit MCP extension loading. See [SDK types](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/src/core/extensions/types.ts#L1814-L1827) and [MCP docs](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/mcp.md#L252-L274).

Discover worker connections only through trusted host facilities. Classify each **operation + arguments + resource + nested route**; deny unknown/side-effecting capabilities before dispatch. Record allowed and denied calls with task, turn, tool, args digest, source identity. Worker permissions remain independent. Leave direct MCP disabled until real read-parity and write-refusal tests prove security; restricted broker remains safe fallback.

Keep current broker path/link/file count/byte/digest protections, and add **capture-time** wall-clock/output/byte limits, actual copied-content validation, provider scope restrictions and provenance-bound receipts. Stale/unrelated/provider-error evidence cannot authorize a causal diagnosis. [Audit A07/A08](../tasks/p1/codebase-gap-audit.md).
