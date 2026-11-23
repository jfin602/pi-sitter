# P1 — Pi Sitter 1.0 Test-directed implementation prompt stack

**Status:** PROMPTS AUTHORED / NOT EXECUTED / NOT QUALIFIED. **Authoring basis:** `d028500`, approved Q1–Q10 and audit A01–A12.  
**Historical assigned versions — superseded 2026-11-23:** P1 `0.1.1` through P10 `0.1.10`, originally planned from `0.1.0`, are **not valid future checkpoint assignments** under [ADR 0002](../../decisions/0002-change-driven-versioning.md). **Execution HOLD:** do not run this stack until the runner, prompt texts and tests are migrated/qualified. `1.0.0` still requires separately approved release qualification.

## Runner-ready prompt inventory

| Prompt | File | Audit IDs | Historical assigned version (retired) | Gate |
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

These are the exact ten authored **historical runner-grammar** files. Their fixed-version lines must not be executed under the replacement policy. The first nine were bounded implementation prompts; the tenth has a **Browser required: yes.** manual interlock, which the migration must preserve. The conceptual F0-R/P1–P6 roadmap workstreams differ from the sequential runner prompt numbers.

## Bounded handoff

1. [Assessment](prompt-assessment.md) → [implementation plan](implementation-plan.md) → [all A01–A12 findings](codebase-gap-audit.md) → [qualification ledger](qualification/README.md).
2. Owner reviews exact texts; authoring or syntax checks do not authorize execution. **Do not execute `npm run codex:phase -- p1`** until executable prompts and the runner/checkpoint transition are revised, independently tested, and separately authorized by the owner.
3. **KNOWN F0-R/CI issue:** `tests/runner/pi-sitter-runner-compat.test.mjs` asserts zero P1 prompts and constant `0.1.0`. The original P1 prompt proposed a phase-linked correction, which now must be replaced with a transition-safe next-patch invariant. Until the separately tested fix is implemented, CI may be red. Do not misrepresent this as a pass; preserve canonical Dope scripts.
4. Verify original trigger behavior unchanged, full original requirements persisted, complete controller-owned acceptance inventory, strict Vitest evidence, host-enforced read-only MCP, constrained test execution, attempt-bound replay and a true independent requirement audit. On non-GREEN, stop and append correction evidence.
5. Manual native P10 and formal `1.0.0` publication require independent owner approval. No prompt owns scored llm-zone benchmark criteria.

[Project architecture](../../ARCHITECTURE.md) · [dev runner](../../runner.md).
