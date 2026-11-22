# P1 — Pi Sitter 1.0 Test-directed implementation prompt stack

**Status (2026-11-22):** P1 committed as `016afdc`; P2 automated checks recovered at uncommitted `0.1.2`; P3–P9 unexecuted; P10 manual; 1.0 not qualified. **Authoring basis:** `d028500`, approved Q1–Q10 and audit A01–A12.
**First implementation checkpoint:** `0.1.1` from package `0.1.0`. **Manual final:** P10 `0.1.10`. **Release:** `1.0.0` only after separately approved qualification/publication.

## Runner-ready prompt inventory

| Prompt | File | Audit IDs | Version | Gate |
| --- | --- | --- | --- | --- |
| P1 | [`P1-runner-and-trigger-baseline.txt`](P1-runner-and-trigger-baseline.txt) | A01 A02 | `0.1.1` | Implementation |
| P2 | [`P2-trusted-task-and-gate-manifest.txt`](P2-trusted-task-and-gate-manifest.txt) | A03 | `0.1.2` | Implementation |
| P3 | [`P3-vitest-report-validation.txt`](P3-vitest-report-validation.txt) | A04 A10 early | `0.1.3` | Implementation |
| P4 | [`P4-isolated-verifier-and-checkpoints.txt`](P4-isolated-verifier-and-checkpoints.txt) | A05 A06 | `0.1.4` | Implementation |
| P5 | [`P5-filtered-worker-mcp-research.txt`](P5-filtered-worker-mcp-research.txt) | A07 | `0.1.5` | Implementation |
| P6 | [`P6-bounded-snapshot-and-receipts.txt`](P6-bounded-snapshot-and-receipts.txt) | A08 | `0.1.6` | Implementation |
| P7 | [`P7-causal-structured-recovery.txt`](P7-causal-structured-recovery.txt) | A09 | `0.1.7` | Implementation |
| P8 | [`P8-requirements-and-attempt-bound-replay.txt`](P8-requirements-and-attempt-bound-replay.txt) | A10 A11 | `0.1.8` | Implementation |
| P9 | [`P9-cross-project-integration-qualification.txt`](P9-cross-project-integration-qualification.txt) | A12 | `0.1.9` | Implementation |
| P10 | [`P10-manual-real-pi-mcp-closeout.txt`](P10-manual-real-pi-mcp-closeout.txt) | A12 manual | `0.1.10` | Manual T3; runner-blocked |

These are the exact 10 authored runnable-grammar files. The first nine are bounded implementation prompts; the tenth has a **Browser required: yes.** manual interlock, and the unchanged Dope runner must refuse automation of it. The conceptual F0-R/P1–P6 roadmap workstreams differ from the sequential runner prompt numbers.

## Bounded handoff

1. [Assessment](prompt-assessment.md) → [implementation plan](implementation-plan.md) → [all A01–A12 findings](codebase-gap-audit.md) → [qualification ledger](qualification/README.md).
2. Owner reviews exact texts; no implementation execution is implied by authoring. To validate syntax only: `npm run codex:phase:validate -- p1`. The [runner preflight](../../runner.md#execution-environment-and-checkpoint-preflight) must pass inside the Codex child before implementation; an outer-terminal pass alone is insufficient.
3. P1 replaced the old fixed-version and zero-prompt compatibility assertions. P2 initially stopped because the child could not run Git fixtures or bubblewrap; its [recovery evidence](qualification/P2-2026-11-21-not-green.md) records passing checks and the `0.1.2` version change. The runner still owns the P2 commit. Unexecuted P3–P9 prompts now require the child preflight before source edits.
4. Verify original trigger behavior unchanged, full original requirements persisted, complete controller-owned acceptance inventory, strict Vitest evidence, host-enforced read-only MCP, constrained test execution, attempt-bound replay and a true independent requirement audit. On non-GREEN, stop and append correction evidence.
5. Manual native P10 and formal `1.0.0` publication require independent owner approval. No prompt owns scored llm-zone benchmark criteria.

[Project architecture](../../ARCHITECTURE.md) · [dev runner](../../runner.md).
