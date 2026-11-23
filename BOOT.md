# Pi Sitter — Current Implementation and Handoff

**2026-11-23 documentation-only policy addendum:** [ADR 0002](docs/decisions/0002-change-driven-versioning.md) and [versioning policy](docs/VERSIONING.md) approve one next-patch increment per successful prompt retaining changes in this repository, not per phase. The migration **has not been implemented or qualified**; package version remains `0.1.0` in the checked GitHub baseline, fixed-version P1–P10 prompts cannot be executed as-is, and no npm publishing/release is authorized.

**As of:** 2026-11-21. **Architecture:** 10/10 owner decisions approved in [GitHub issue #1](https://github.com/jfin602/pi-sitter/issues/1). **Documentation application:** this foundation follows approved [review #2](https://github.com/jfin602/pi-sitter/issues/2). **Release:** `0.1.0` source, not 1.0 qualified or published on the basis of this documentation.

## Observed on source baseline before this doc application

- Standalone `pi-sitter` Pi extension manifest points to `src/index.ts`; `src/` implements existing worker triggers, supervisor lifecycle, command/status UI, gate reports, completion and a separate supervisor session.
- `src/gates.ts`: `GateReport` schema v1; `PASS/FAIL/UNVERIFIED` gate results. `src/completion.ts`: `VERIFIED/RECOVERY_REQUIRED/UNVERIFIED/BLOCKED` decisions.
- `src/verifier.ts`: host-set absolute command, `bubblewrap`, JSON output, preliminary shape validation; no native Vitest provenance adapter yet. Its read-only whole-host bind is not confidentiality isolation.
- `src/broker.ts`: bounded evidence snapshot and provider-defined read inspection.
- `src/supervisor-session.ts`: separate Pi session, `pi_sitter_inspect` only. **Direct worker-equivalent MCP parity is disabled**, pending qualified host-enforced filtering.
- Existing `tests/*.test.mjs` cover various deterministic loader/broker/safety/completion cases. These are source evidence of tests, **not proof they pass on the current checkout**.

## Approved design still requiring implementation

- Protected suites and structured Vitest gate identity, coverage, source/suite freshness checks; tests determine gates, not model interpretation.
- Milestone/final test checkpoints with repair reruns; existing non-test triggers unchanged.
- Automatic discovery of worker MCP research abilities with per-operation host-enforced read-only filtering.
- Narrowly scoped sandboxed verifier, detailed evidence-backed recovery and independent requirement-level review.
- Multi-project and real Pi/MCP independent qualification before 1.0.

## Audit-accepted implementation plan — /docs-apply of Issue #3

**Source baseline:** `feea1c18e74d09d5db64155268eb7d75a6198dda` before this documentation-only application. **Status:** planning APPLIED; code changes A01–A12 NOT IMPLEMENTED; full 1.0 release NOT QUALIFIED.

Four observed gaps in the [source audit](docs/tasks/p1/codebase-gap-audit.md):
- `src/completion.ts:27–39` can declare `VERIFIED` with omitted mandatory gates or uninspected requirements. **Highest-priority correctness blocker.**
- `src/core.ts:211–214` truncates the authored task to 700 characters, losing later original requirements.
- `src/core.ts:84–140` can label successful plain-text `edit` and `write` receipts `UNKNOWN`; characterize provider differences but **do not change triggers without separate approval**.
- `tests/runner/pi-sitter-runner-compat.test.mjs` assumes package version exactly `0.1.0` and no P1 prompt files; these assertions will fail upon legitimate first checkpoint/prompt authoring.

The audit also identified stale report/replay risks, lack of host-verified source/suite/test completeness, no qualified MCP read-parity, and a broad read-only host bind in the verifier. All are **planned only**.

**Verified baseline evidence (not 1.0 evidence):** [CI 44943269353](https://github.com/jfin602/pi-sitter/actions/runs/44943269353) on the audited SHA: 109 developer-runner tests and 47 Pi Sitter runtime tests passed; TS check and npm pack dry-run passed. Audit-local checks: runner 109/109, analysis 3/3; local verifier namespace could not start in that audit environment, but baseline sandbox check passed in CI. Native Pi/MCP and protected Vitest verification are **not qualified**.

**Immediate next work:** F0-R (A01, A02) transition-safe runner compatibility checks and golden trigger regression inventory; then P1 (A03, A04) trusted manifest/full task capture and a shared normalized Vitest gate input. The false-`VERIFIED` negative sentinel is mandatory from P1 even though complete independent requirement review is P4. See [implementation plan](docs/tasks/p1/implementation-plan.md) and [R01–R11 ledger](docs/tasks/p1/qualification/README.md).

**Unresolved owner policy:** configured advisory budget may allow 32 but accounting history holds 16; no change allowed by this documentation application. Trusted-controller ingress, new wire fields, legacy v1 read behavior and unfamiliar tool receipts require focused design/review before implementation.

The original [ADR](docs/decisions/0001-ten-approved-decisions.md) remains authoritative. The developer Dope runner is separate from Pi Sitter runtime; no source, tests, prompts, package version, tags, npm publication, or runner implementation execution is authorized here.
