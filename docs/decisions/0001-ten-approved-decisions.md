# ADR 0001 — Pi Sitter 1.0 Approved Architecture (Q1–Q10)

**Date:** 2026-11-21  
**Status:** APPROVED DESIGN / NOT YET IMPLEMENTED OR QUALIFIED  
**Authority:** [Owner's ten recorded answers](https://github.com/jfin602/pi-sitter/issues/1) (Options B, Q1–Q10).  
**Context:** Initial extracted extension had too much free-ranging supervision and limited MCP/tools; the owner wants evidence-focused gates without dismantling working triggers.

| Q | Approved decision | Non-negotiable consequence |
| --- | --- | --- |
| 1 | **Test-directed with existing emergency triggers** | Preserve already-working triggers and thresholds exactly; Vitest focuses normal gate investigation |
| 2 | **Separate protected acceptance tests** | Worker may author development tests; worker/Sitter may not alter scoring tests |
| 3 | **Structured machine-readable gate reports** | Reports, not raw console parsing, determine gate focus; logs are on-demand evidence |
| 4 | **Milestone and final verification** | Run after milestone completion, repair and final; not every edit |
| 5 | **Evidence-guided research** | Follow causally relevant dependencies/files/logs/MCP, never unrelated work |
| 6 | **Same worker MCP connections, filtered tools** | Host-enforced per-operation read-only; deny unknown/writes |
| 7 | **Isolated approved verification runner** | No arbitrary supervisor shell or changes to tests/commands |
| 8 | **Structured recovery instructions** | Evidence, cause, affected files, ordered repairs and verification; worker implements |
| 9 | **Tests plus independent requirement audit** | Verified, failed and unverified requirements reported separately; controller owns outcome |
| 10 | **Full independent 1.0 qualification** | Package/Pi/Vitest/MCP/safety/recovery/multi-project evidence + owner closeout |

**Alternatives rejected:** strict test-only waking or unrestricted roaming; worker-editable or fully frozen development tests; raw logs as gate authority; continuous or worker-only acceptance cadence; strictly named files or unrestricted investigation; prompt-only tool safety or wholly manually configured MCPs; direct shell or external-only reruns; brief or continuously interactive guidance; tests-only or supervisor-only final success; basic-only release or mandatory benchmark uplift before release.

**Consequences:** Vitest is the first adapter but not a permanent core dependency; `llm-zone` owns formal scoring and consumes pinned releases. Q1 expressly forbids altering currently working triggers. Preserve current source truth separately from approved design. Revisions require new owner decisions; implementation contracts may add precise schemas but must be reviewed before declaring them authoritative public APIs.

**Follow-on:** [Docs review #2](https://github.com/jfin602/pi-sitter/issues/2); [architecture](../ARCHITECTURE.md), [contracts](../README.md), and [qualification](../stability-contract.md).
