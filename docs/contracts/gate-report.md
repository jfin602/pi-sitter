# Contract — Structured Acceptance Gate Report

**Status:** Q2/Q3/Q4/Q9 **APPROVED DIRECTION**. P2 adds the provisional controller ingress. P3 implements strict internal schema 2 normalization and a Vitest JSON adapter. Final public wire fields and independent requirement review remain unapproved/unimplemented.

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

**Legacy v1:** retain original schema v1 as labeled historical evidence; never silently migrate old rows to successful current runs. The P2 internal ingress and v1 read policy below are provisional; final field names and public compatibility require focused owner review. [Audit A03/A04/A10](../tasks/p1/codebase-gap-audit.md).

## P2 provisional internal ingress and migration

`createPiSitter({ loadControllerContext(stage, projectRoot) })` is an embedding-host dependency. It returns `ControllerContext` (`src/controller-context.ts`): stable `taskId` and `stage`; complete `originalTask` text, reference, version and anchored requirement IDs/text; protected suite ID/version/SHA-256 digest with mandatory gate IDs, requirement IDs and test IDs; and the saved source SHA-256 snapshot. This callback must be installed by the controller outside Worker write authority. Pi 1.5.2 exposes no native controller-owned task/manifest field or API that authenticates arbitrary extension dependencies. A default extension loaded without this host callback has **no authoritative inventory** and blocks current verification. The existing `loadGates` callback is retained for source compatibility but supplies no protected authority.

The internal schema 2 runner input is `{schemaVersion:2, taskId, stage, snapshotIdentity, suite:{id,version,digest}, gates:[{id,tests:[{id,result,evidence}]}]}`. Each test result is `PASS | FAIL | SKIP`. The host inventory supplies all criteria; the runner input may supply only observations. Extra caller criteria/fields, duplicate/unknown/missing IDs, mismatched task/stage/source/suite, empty PASS/FAIL evidence and bounded-size violations block before persistence or recovery. Pi Sitter derives gate outcomes and counts from the complete mandatory test rows. Development test rows cannot replace scored IDs. The injected and configured verifier paths use the same normalization at `src/index.ts`; verification requires valid host inventory before invoking either runner path and checks that the task and protected suite remain stable across the run. The completed report must match the host's current source identity. The built-in command path stays blocked until the embedding host supplies controller context and a schema 2 report. Suite/source identities are compared, not independently computed by Pi Sitter in this phase; their actual provenance remains a host/runner qualification obligation.

**P3 migration:** Current internal schema 2 input additionally requires a stable `runId`, exact `testCounts` (`executed`, `skipped`, `passed`, `failed`) and `execution.exitCode` (0 for no failed assertion, 1 for an attributable assertion failure). Reusing the previous run ID blocks a new verification. Optional bounded assertion diagnostics carry message, expected/actual, path/line and log/artifact references. Test IDs may contain spaces because Vitest `fullName` is used exactly. The `format: "vitest-json"` envelope carries the same task/run/source/suite/execution identities plus Vitest's JSON reporter object; `src/vitest-report.ts` maps its assertion rows to the controller manifest. Both envelope and generic rows reach `normalizeGateReport` before persistence. A command verifier must emit one JSON object on stdout; a normal exit 1 is parsed, while timeout, signal, malformed JSON, exit mismatch and non-assertion exits block. Current all-pass results still remain `UNVERIFIED` until independent requirement review. A v1 report is historical only.

Pi session entries retain only a bounded controller identity record. The full task and protected inventory are reloaded from the host at session start and before current verification. A user prompt is never promoted into the controller inventory. Old schema 1 entries remain renderable as **HISTORICAL**; a v1 result cannot become a present-tense PASS. Schema 2 all-pass tests remain `UNVERIFIED` until the separate requirement-level audit from the completion contract is implemented. This is an internal migration boundary, **not owner approval of a stable exported wire format**.
