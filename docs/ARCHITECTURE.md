# Pi Sitter — Architecture Boundary

**Status:** Approved direction from Q1–Q10, with several **not implemented** adapters. Do not infer runtime features from diagrams.

## Control and data flow

1. Pi Worker executes task and owns source edits; existing `src/core.ts` triggers remain intact.
2. At a milestone or final completion, an external trusted verification controller invokes a protected acceptance suite (initially Vitest), not model-selected commands.
3. Runner normalizes results into a strictly validated, framework-neutral gate report with source/suite identities, failure evidence and artifact refs.
4. Pi Sitter reads the failed/blocked gate report and investigates related project evidence through host-enforced read-only snapshot/MCP operations. Existing emergency triggers can still request scoped diagnosis.
5. Pi Sitter emits a structured recovery package; supervisor stops. Worker repairs and verification reruns.
6. At final task review, Pi Sitter independently classifies each requirement as verified/failed/unverified; controlling workflow owns formal completion outcome.

## Existing implementation vs target seams

- Current `src/index.ts`: event/command integration, session lifecycle, current verifier and recovery orchestration.
- Current `src/broker.ts`: bounded immutable snapshot abstraction; `src/supervisor-session.ts` only exposes `pi_sitter_inspect`; **no direct MCP parity yet**.
- Current `src/gates.ts`: schema v1 `PASS/FAIL/UNVERIFIED`; `src/verifier.ts`: trusted command + basic JSON checks; **no Vitest suite provenance adapter yet**.
- Current `src/completion.ts`: summarized decisions; independent requirement matrix still to be qualified.
- Proposed adapter seams must be generic and testable, not Pi/llm-zone test implementation embedded in the reasoning core.

## Two different runners

**Runtime verification runner**: invoked by Pi Sitter through trusted host authority, constrained shell/filesystem/network, provides structured test evidence; cannot write acceptance tests.

**Developer Codex phase runner** (`scripts/codex-phase.mjs`): separately owner-authorized implementation workflow, checks prompt versions, makes Git commits and stores logs in ignored `.codex-runs/`. It is **not** a Pi Sitter supervisor tool, cannot affect benchmark gate decisions and is excluded from the published extension package.

## Trust map

| Principal | May modify implementation | May modify protected tests | May set test-gate result |
| --- | --- | --- | --- |
| Worker | Yes within task | No | No |
| Test/controller author | Separately authorized only | Yes | Defines test mapping |
| Approved runner | Temporary isolated artifacts only | No | Deterministic normalized test facts |
| Pi Sitter | No | No | No; consumes results and audits requirements |
| Formal benchmark/controller | Owns final status | Controls approved changes | Owns authoritative result ledger |

Refer to [contracts](README.md), [current implementation](../BOOT.md), and [stability policy](stability-contract.md).

## Audit-driven vNext integration design (planned)

**Two independently authorized evidence ledgers:** the controller's protected acceptance suite reports test-gate facts; a separate review compares implementation artifacts with **every original requirement**. A `VERIFIED` aggregate requires both complete expected test coverage and requirement-level evidence. Current `src/completion.ts` does not enforce this yet. Bounded prompts must not truncate the controller's durable original task record (`src/core.ts` currently stores only 700 characters).

**Trusted immutable identities:** task ID + requirement version, milestone/stage, verified source snapshot digest, protected suite ID/version/digest, attempt/run ID. Bind report, UI, recovery, stored replay and reruns to this identity, never `stage` alone.

**Tool-observation seam:** adapt external provider names, receipt shapes and root fields without modifying T1–T4 triggering semantics. Characterize `save_scene`, `scene_tree`, `get_parse_errors`, `open_scene`, plus generic `edit`/`write` text receipts. Keep existing `gameDir` compatibility if a neutral project-root field is introduced; no Godot scoring inside core.

**Test-author correction:** suspect acceptance-test defects go to the authorized suite owner; neither worker nor supervisor may amend scored tests. Historical schema v1 reports may remain readable but cannot be silently reclassified as current validated vNext PASS. [Audit A01–A12](tasks/p1/codebase-gap-audit.md).
