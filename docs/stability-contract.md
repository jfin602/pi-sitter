# Pi Sitter — Safety and 1.0 Qualification Contract

**Forward acceptance policy only.** A listed gate does not mean current code passed it.

## Hard stops

1. Never permit supervisor model to modify source, tests, criteria, environment, Git history or workflow state by direct or indirect tools.
2. Never treat tool names or MCP server membership as proof a call is read-only; deny unclassified or indirect mutation.
3. Never let model output or project files choose verification executable/args, acceptance suite, expected results or elevated permissions.
4. Never mark a gate PASS without authenticated approved suite/run coverage, source freshness and actual passing assertions. Missing/skipped/malformed outputs produce UNVERIFIED/BLOCKED as appropriate.
5. Never claim task completion from passing tests alone if original requirements are unverified or failed.
6. Never treat a whole-host read-only mount as least-privilege confidentiality confinement.
7. Never weaken or silently alter existing supervisor triggers; never create continuous idle inference.
8. Never run an unapproved Codex implementation stack, auto-close manual Pi/MCP qualification, or publish `1.0.0` as a side effect of document application.
9. Never conflate `llm-zone` formal benchmarking with Pi Sitter's independent release qualification.

## 1.0 required evidence matrix

| ID | Case |
| --- | --- |
| R01 | Dope developer runner byte identity, grammar, Git checkpoint/resume tests |
| R02 | Standalone Pi package/extension discovery, idle lifecycle and old trigger regressions |
| R03 | Vitest structured gate report: pass, fail, skipped/unverified and blocked |
| R04 | Suite/gate identity, approved test coverage, source snapshot freshness, malformed/duplicate negative cases |
| R05 | Milestone/final and repair-rerun cadence without changing non-test triggers |
| R06 | Worker MCP read-operation parity and host/tool-layer denial of mutation/indirect mutation |
| R07 | Approved isolated verification commands, bounded resources, confinement, scratch cleanup |
| R08 | Specific evidence-backed recovery and bounded causal investigation |
| R09 | Test-gate PASS plus distinct verified/failed/unverified requirement review |
| R10 | Real Pi/MCP loading and multiple project fixtures, including non-Godot |
| R11 | Independent manual owner review, publish-ready package and release disposition |

Evidence for each: exact Git SHA and dirty state, Node/Pi/Vitest versions, command, environment, expected/observed results, logs/artifacts or reference, PASS/FAIL/NOT RUN/BLOCKED/EVIDENCE GAP, unresolved limitations and owner disposition.

Headless tests are not real Pi model inference or MCP interoperability proof. A commit, docs file or simulated positive result does not close any native or release gate.

## Source-audit release blockers (A01–A12)

- **F0-R:** runner compatibility must permit legitimate prompt/version progression while retaining canonical Dope script bytes, no-lock policy, grammar and manual closeout; T1–T4 before/at/after golden cases must match existing behavior. No implicit correction of 16/32 advisory budget mismatch.
- **P1:** absent mandatory gate/test and passing export with uninspected accessibility must not yield VERIFIED; >700-character authored requirements must survive; both verifier ingestion paths fail closed; nonzero assertion failures are not silently treated as infrastructure failures.
- **P2/P3:** unrelated host data inaccessible; writes/shell/indirect MCP mutations denied; current source, suite and run identity bound to each result; capture/outcome budgets enforced.
- **P4:** unsupported recovery advice abstains; requirement matrix is independent; blocked retry and task/suite change never replay stale PASS or wrong recovery as current.
- **P5/P6:** packed install in unrelated project, real Pi+MCP, and manual owner review remain required. Baseline 109 runner + 47 extension tests and npm pack dry-run do not satisfy full 1.0 release qualification.

See [audit](tasks/p1/codebase-gap-audit.md), [plan](tasks/p1/implementation-plan.md) and [ledger](tasks/p1/qualification/README.md).
