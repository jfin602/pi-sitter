# P1 — Pi Sitter 1.0 Test-Directed Architecture

**Status:** PLANNED / NOT AUTHORED AS RUNNER PROMPTS / NOT EXECUTED / NOT QUALIFIED  
**Authority:** [ADR 0001](../../decisions/0001-ten-approved-decisions.md) and [contracts index](../../README.md).  
**Starting package:** `0.1.0`. The historical Dope `p1` stack expects version increments `0.1.1`–`0.1.6` once implementation prompts are authored and approved. `1.0.0` is separate owner-qualified release.

## Candidate prompt boundaries (not yet runnable)

| Prompt | Responsibility | Required proof |
| --- | --- | --- |
| P1 | Strict structured gate-report, suite provenance and Vitest adapter | Valid/invalid/missing/skipped/freshness negative tests |
| P2 | Approved isolated runner with least-privilege sandbox | Reject command injection, writes, disclosure, timeout and stale evidence |
| P3 | Safe worker MCP capability discovery and host read-only tool policy | Read parity and indirect mutation refusal; preserve existing triggers |
| P4 | Bounded evidence-specific recovery and independent requirement review | Detailed repair and separate requirement/acceptance ledger |
| P5 | Integrated safety/regression, installation and non-Godot fixtures | Headless reports, unchanged lifecycle, manual closeout handoff |
| P6 (manual) | Real Pi extension / MCP / 1.0 release qualification | Separately owner-authorized; never auto-GREEN or auto-publish |

Before authoring implementation prompts, inspect current HEAD and real Pi/MCP APIs, validate adapter feasibility and finalize the proposed schema fields. The owner must review complete prompt texts before execution. Preserve current trigger definitions exactly; no benchmark-specific fixtures in core logic.

## Deferred/not authorized

No public npm publication, release tag, automatic closeout, full benchmark execution or llm-zone source edits during this docs foundation. No V1 schema migration without corresponding tests and separately approved implementation.

See [qualification template](qualification/README.md). An authored prompt/commit is NOT evidence of qualified functionality.

## Applied source-audit execution order (Issue #3)

**F0-R prerequisites before any P1 prompt execution:** A01 transition-safe `tests/runner/pi-sitter-runner-compat.test.mjs` and A02 source-anchored T1–T4 golden coverage. These are **planned fixes** to implement in a separately approved prompt. Existing triggers, runner scripts and advisory budget remain unchanged under this documentation action.

| Execution phase | Audit IDs | Source focus | Key acceptance |
| --- | --- | --- | --- |
| F0-R | A01, A02 | runner compatibility test, `src/core.ts`, `src/config.ts`, adapter tests | Accept a valid `0.1.1` checkpoint and prompts; reject bad grammar; freeze existing triggers |
| P1 | A03, A04 + early A10 negative | `src/core.ts`, `src/gates.ts`, `src/verifier.ts`, `src/index.ts` | Full task + trusted expected manifest; both verifier paths normalized; incomplete/all-green report not VERIFIED |
| P2 | A05, A06 | verifier, index, verifier tests | Approved restricted run, correct milestone/final/post-repair checks, cleanup |
| P3 | A07, A08 | broker, supervisor-session, Pi integration | Vet actual MCP read parity; deny indirect writes; source-bound receipts |
| P4 | A09, A10, A11 | analysis, prompt, completion, index, UI tests | Causal repair; independently evidenced requirements; no stale report/replay |
| P5–P6 | A12 | package/loader tests, multi-project fixtures, manual proof | Tarball install; end-to-end unrelated projects; real Pi/MCP and owner closeout |

**Stop rules:** no advancement on a failed negative/security gate, unverified provenance, changed trigger semantics, unauthorized acceptance-test modification, schema guesswork or incomplete manual evidence. Preserve failed evidence and append a reviewed recovery task. Proposed vNext schema fields, legacy v1 handling and controller-owned ingress need focused approval before those implementation steps. See [complete A01–A12 audit](codebase-gap-audit.md) and [dependency plan](implementation-plan.md). **No prompt texts authored/executed and no version changed by this docs application.**
