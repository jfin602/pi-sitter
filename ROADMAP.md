# Pi Sitter — Roadmap to Independent 1.0 Qualification

**State:** Architecture decisions **APPROVED**; implementation and independent qualification **NOT COMPLETE**. [Owner worksheet](https://github.com/jfin602/pi-sitter/issues/1) and [applied-doc review](https://github.com/jfin602/pi-sitter/issues/2) control design.

| Phase | Deliverable | Gate and evidence |
| --- | --- | --- |
| F0 — Docs + developer runner | Vault-style agent router, scoped docs/ADRs, exact Dope Codex runner, regression CI | Applied files and later source-bound CLI/CI checks; no runtime GREEN inferred |
| P1 — Test-directed gates | Strict generic gate schema, Vitest normalizer/adapter, protected suite identity and coverage | PASS/FAIL/UNVERIFIED/BLOCKED with freshness, duplicate, skipped and malformed negative fixtures |
| P2 — Verification boundary | Approved isolated test runner with least-privilege file access, bounded outputs and artifacts | Mutating command, path, network, timeout, cancellation and source drift negative tests |
| P3 — MCP tool parity | Safely discover worker MCP read operations; deny unknown and indirect mutations at host layer | Read parity plus denied write calls in real Pi/MCP integration |
| P4 — Recovery and requirement verification | Specific failure-led research, repair plan, separate requirement audit | Multi-file failures, task scope controls, evidence/uncertainty and no false completion |
| P5 — Integrated qualification | Multiple unrelated fixtures incl. non-Godot; existing trigger regression and package/loader checks | Exact source-bound headless + real Pi evidence matrix |
| P6 — Owner manual closeout | Real installed Pi session / MCP / release evidence review | Owner explicitly approves or holds 1.0.0 release |

P1–P6 are **planned scopes** and do not yet constitute executable prompt files. See [docs/tasks/p1/README.md](docs/tasks/p1/README.md).

The unmodified Dope runner's historical `p1` sequence would use intermediate `0.1.1` through `0.1.N` checkpoints from the current `0.1.0` baseline. **`1.0.0` is reserved for independently qualified owner-approved publication**; no version bump is authorized by docs-apply.
