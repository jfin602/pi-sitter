# Contract — Structured Acceptance Gate Report

**Status:** Q2/Q3/Q4/Q9 **APPROVED DIRECTION**; proposed schema fields and normalization **NOT IMPLEMENTED / NOT YET APPROVED AS FINAL API**. Initial adapter: Vitest; supervisor core must be framework-neutral.

## Separation of authorities

A trusted test controller owns gate ID, suite manifest, required tests/coverage and version/digest. The worker can author development tests but cannot change protected acceptance criteria. The runner produces machine-readable facts. Pi Sitter reads those facts, investigates and reports recovery; it does **not** calculate a new acceptance policy or invent a gate.

## Candidate vNext report fields

- `schemaVersion`, `runId`, `stage/taskId`, `milestoneId`, `sourceSnapshot` (content identity + Git source revision where available), `suiteIdentity` (ID/version/digest of protected manifest), timestamps and runner/environment version.
- For each declared gate: stable `gateId`, requirement reference, required test IDs, observed test IDs, result `PASS | FAIL | UNVERIFIED`, assertion diagnostics (expected/actual/error/stack/source locations), evidence/log/artifact references, explanation and limitations.
- Run-level `COMPLETED | BLOCKED` (invalid command, timeout, canceled, crashed, missing/malformed report, integrity drift); `BLOCKED` is not an assertion failure.
- Optional broader task requirement review is a separate contract; do not overload acceptance test results with model judgment.

## Fail-closed interpretation

- PASS: every declared mandatory test was executed, passed, on an approved suite and matching source snapshot; no missing/duplicate gate/test IDs or unresolved integrity errors.
- FAIL: a genuine attributable test assertion failed under an otherwise valid run.
- UNVERIFIED: skipped, missing, insufficient coverage/evidence, unresolved test identity or unverifiable claimed result.
- BLOCKED (run status): runner unavailable, timeout, canceled, bad JSON/schema, unauthorized command, source/suite identity mismatch or infrastructure crash. Never manufacture successful gate statuses from these.
- Raw stdout may be retained as on-demand diagnostic evidence; it is not the primary gate authority. Bound report size and sanitize paths and secrets.

## Migration compatibility

Current `src/gates.ts` `schemaVersion: 1` and `src/verifier.ts` preliminary shape checks remain current implementation; a future normalized Vitest report must be strictly validated and deliberately migrated or version-bumped, **not silently reinterpreted**. Existing `docs/verification.md` documents current v1 behavior.

## Qualification tests

Valid mixed results, all-pass report, missing/skipped tests, duplicate IDs, altered suite digest, stale source SHA, incorrect counts, empty gates, malformed JSON, path/artifact references, cancelled and timeout runs. Every negative fails closed.

## Source-audit hardening — required behavior, candidate wire schema still pending

**Expected-vs-observed:** the trusted controller, not a producer-supplied gate list, owns the required gate/test manifest, task requirements and protected suite identity. Require complete declared membership, accurate executed/skipped counts, uniqueness, source freshness and bounded evidence. A missing expected gate/test, altered suite digest or snapshot cannot yield PASS. The audited `decideCompletion` false-success on a report with only A when A+B were required is a mandatory negative regression.

**Single ingestion boundary:** both `src/index.ts` injected verifier and `src/verifier.ts` command verifier MUST normalize/validate through the same path *before* state persistence, UI, repair or completion. Vitest assertion failures may exit nonzero: inspect structured output even when exit nonzero and distinguish attributable FAIL from crashes, cancellations, timeouts, malformed results or isolation failures (BLOCKED). Ordinary skipped/uncovered is UNVERIFIED, never PASS.

**Legacy v1:** retain original schema v1 as labeled historical evidence; never silently migrate old rows to successful current runs. Trusted manifest ingress, final field names and explicit v1 read policy need focused owner review before implementation. [Audit A03/A04/A10](../tasks/p1/codebase-gap-audit.md).
