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
