# Pi Sitter P1 Qualification — Empty Evidence Ledger

**Status: TEMPLATE / NOTHING EXECUTED OR QUALIFIED BY DOCUMENT AUTHORING.** Record each result with exact Git SHA/dirty source, runner/Pi/Node/Vitest versions, execution environment, exact command, expected observation, actual evidence and resulting status.

| Gate | Required demonstration | Initial |
| --- | --- | --- |
| R01 | Dope runner byte identity, prompt grammar, Git/resume regression | NOT RUN |
| R02 | Existing Pi extension loading, modes, idle and trigger regressions | NOT RUN |
| R03 | Structured Vitest pass/fail/skipped/blocked normalization | NOT RUN |
| R04 | Protected suite ID/digest, source identity, coverage, duplicates and invalid-report denials | NOT RUN |
| R05 | Milestone/final and repair rerun cadence, unchanged emergency triggers | NOT RUN |
| R06 | Worker MCP read parity, deny every known and indirect mutator | NOT RUN |
| R07 | Approved verifier command/sandbox constraints, temp cleanup and resource caps | NOT RUN |
| R08 | Evidence-backed root cause and concrete recovery; stay task-scoped | NOT RUN |
| R09 | Distinct gate and requirement verified/failed/unverified findings | NOT RUN |
| R10 | Pi loader, multiple unrelated projects and at least one non-Godot | NOT RUN |
| R11 | Real native Pi+MCP test and owner manual release closeout | NOT RUN |

Use `PASS`, `FAIL`, `NOT RUN`, `BLOCKED`, `EVIDENCE GAP`. A simulated tool response, Git commit, green unit suite or model answer does **not** by itself prove native integration. Preserve negative reports as evidence; append repairs/rechecks.

## Source audit acceptance matrix (additions to R01–R11, not yet qualified)

| Existing gate | Mandatory audit negative/positive cases | Status |
| --- | --- | --- |
| R01 | A01 exact Dope runner SHAs and no-lock; first valid prompt+version checkpoint accepted; malformed prompt/wrong commit rejected | NOT RUN for transition |
| R02 | A02 T1 two equivalent failures, T2 two-enable/three-discovery/repeated setup, T3 final validator, T4 no-progress; Off/Shadow/Active, cancellation/reload; unknown edit/write receipts characterized | NOT RUN for new goldens |
| R03/R04 | A03/A04 omitted gate B, skipped tests, changed source/suite, duplicate IDs, oversized/malformed reports, v1 archive; Vitest PASS vs assertion FAIL vs timeout/crash BLOCKED | NOT RUN |
| R05 | A06 milestone subset/final required coverage/post-repair new snapshot/no every-edit testing | NOT RUN |
| R06 | A07/A08 real Pi worker+supervisor vetted reads, direct/indirect denied mutation, stale provider receipt/capture bounds | NOT RUN |
| R07 | A05 host secret read denied, source/suite write denied, scratch allowed, cleanup/timeout and isolation fail closed | NOT RUN |
| R08 | A09 multi-file failure with cited causal repair; unrelated quote causes abstention | NOT RUN |
| R09 | A10 uninspected accessibility despite all-green export, broken requirement, >700-char requirement across followup/resume; A11 blocked rerun/stage collision/suite drift/replay | NOT RUN |
| R10/R11 | A12 packed install into unrelated TS and another project type incl. non-Godot; real Pi/MCP manual verification + owner disposition | NOT RUN |

**Historical baseline, separate from new 1.0 gate evidence:** [CI 44943269353](https://github.com/jfin602/pi-sitter/actions/runs/44943269353/job/136964909340) @ `feea1c1` recorded 109/109 developer-runner and 47/47 existing extension tests passing, typecheck passed, pack dry-run listed 35 files. Audit-local 109/109 runner, 3/3 analysis tests and dry-run passed; network namespace local verifier run BLOCKED in audit environment, existing CI sandbox fixture passed. Do not mark the new R01–R11 cases GREEN from that baseline. Record source SHA/dirty basis, Pi/Node/Vitest versions, exact commands, expected/observed outputs and artifact refs for each future check.

## Authored prompt-stack status (not executed)

P1–P9 implementation prompt texts and P10 manual closeout have been authored. All **new** F0-R and 1.0 acceptance checks above remain NOT RUN until separately authorized implementation and evidence. Baseline CI will initially detect the temporary `tests/runner/pi-sitter-runner-compat.test.mjs` "zero prompt" assertion; only P1's test-only correction resolves it. Do not record that as GREEN prior to an observed rerun.
