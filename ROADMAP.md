# Pi Sitter — Roadmap to Independent 1.0 Qualification

**State:** Architecture decisions **APPROVED**; implementation and independent qualification **NOT COMPLETE**. [Owner worksheet](https://github.com/jfin602/pi-sitter/issues/1) and [applied-doc review](https://github.com/jfin602/pi-sitter/issues/2) control design.

| Phase | Deliverable | Gate and evidence |
| --- | --- | --- |
| F0 — Docs + developer runner | Vault-style agent router, scoped docs/ADRs, exact Dope Codex runner, regression CI | Applied files and later source-bound CLI/CI checks; no runtime GREEN inferred |
| F0-R — Transition and trigger baselines | A01 unblock valid runner-owned version/prompt progression; A02 goldens for T1–T4 / Off-Shadow-Active | Original runner unchanged; transition CI and triggers match existing behavior; no trigger redesign |
| P1 — Test-directed gates | Strict generic gate schema, Vitest normalizer/adapter, protected suite identity and coverage | PASS/FAIL/UNVERIFIED/BLOCKED with freshness, duplicate, skipped and malformed negative fixtures |
| P2 — Verification boundary | Approved isolated test runner with least-privilege file access, bounded outputs and artifacts | Mutating command, path, network, timeout, cancellation and source drift negative tests |
| P3 — MCP tool parity | Safely discover worker MCP read operations; deny unknown and indirect mutations at host layer | Read parity plus denied write calls in real Pi/MCP integration |
| P4 — Recovery and requirement verification | Specific failure-led research, repair plan, separate requirement audit | Multi-file failures, task scope controls, evidence/uncertainty and no false completion |
| P5 — Integrated qualification | Multiple unrelated fixtures incl. non-Godot; existing trigger regression and package/loader checks | Exact source-bound headless + real Pi evidence matrix |
| P6 — Owner manual closeout | Real installed Pi session / MCP / release evidence review | Owner explicitly approves or holds 1.0.0 release |

P1–P6 are **planned scopes** and do not yet constitute executable prompt files. See [docs/tasks/p1/README.md](docs/tasks/p1/README.md).

The unmodified Dope runner's historical `p1` sequence would use intermediate `0.1.1` through `0.1.N` checkpoints from the current `0.1.0` baseline. **`1.0.0` is reserved for independently qualified owner-approved publication**; no version bump is authorized by docs-apply.

## Source-audited work mapping — Issue #3

**F0-R is a prerequisite for P1 prompt execution**, not evidence that P1 or 1.0 is finished. Apply the 12 audit findings in dependency order:

| Phase | Finding IDs | Acceptance emphasis |
| --- | --- | --- |
| F0-R | A01, A02 | Transition-safe CI; unchanged emergency trigger thresholds and delivery |
| P1 | A03, A04; early A10 sentinel | Controller-owned full task, protected suite inventory; common strict Vitest validation; omitted gate / uninspected requirement cannot pass |
| P2 | A05, A06 | Least-privilege approved runner, explicit milestone/final/repair source-bound attempts |
| P3 | A07, A08 | Read-only worker MCP capability parity with host-side denies; bounded evidence/receipt provenance |
| P4 | A09, A10, A11 | Causally grounded repair, per-requirement VERIFIED/FAILED/UNVERIFIED, attempt-bound UI/replay |
| P5–P6 | A12 | Packed unrelated-project tests + real Pi/MCP and owner manual closeout |

The original `0.1.0` synthetic runner fixture is retained while live compatibility checks must permit runner-owned `0.1.x` transitions. `1.0.0` release is separate and manual. [Audited source findings](docs/tasks/p1/codebase-gap-audit.md) · [Plan](docs/tasks/p1/implementation-plan.md).
