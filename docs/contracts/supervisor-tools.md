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
