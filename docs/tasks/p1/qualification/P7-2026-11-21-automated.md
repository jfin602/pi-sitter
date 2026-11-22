# P7 automated qualification — 2026-11-21

**Basis:** clean pre-task HEAD `6b7a164de5293c5c887049aa3c8a60b09e63289b`, package `0.1.6`; all P7 source, tests and documentation remain uncommitted for the Dope phase runner. Target checkpoint: `0.1.7`. Node `v24.21.0`, npm `11.19.0`, installed Pi `1.5.2`; Vitest is not installed at repo root (the gate adapter has deterministic fixtures). No owner work was present at start.

## Child-environment preflight before edits

- `npm run test:runner` — PASS, 110/110; disposable Git fixtures worked.
- `npm test` — PASS, 80/80; bubblewrap verifier fixture worked.

## Implementation and regression evidence

- `node --experimental-strip-types --test tests/recovery-causal.test.mjs tests/analysis.test.mjs tests/completion.test.mjs tests/safety.test.mjs` — PASS, 28/28 after final receipt and quote refinement. Two-file repair includes failed assertion, source locations, two current inspection receipts, ordered Worker steps and `post_repair` gate/test IDs. Passing-gate quote, stale receipt, provider error and error text serialized inside an otherwise successful inspection payload abstain. Existing recovery retry, mode and safe supervisor tool boundary checks passed.
- `npm run check` — PASS at `0.1.6` before advancing version, and PASS at `0.1.7` after the final refinement.
- `npm test` — PASS, 83/83 at `0.1.6` before advancing version, and PASS, 83/83 at `0.1.7` after the final refinement. Includes existing trigger/mode and verifier isolation regressions.
- `npm run test:runner` — PASS, 110/110 at `0.1.6` before advancing version, and PASS, 110/110 at `0.1.7` after the final refinement; original Dope runner byte identity still passes.
- `git diff --check` — PASS after version advance; `.npmrc` remains `package-lock=false`, root `package-lock.json` absent. No commit, HEAD movement, runner script edit, prompt execution or publication.

## Findings and limits

The structured recovery object is produced for failed gates. It remains `UNVERIFIED` when a failed assertion gives only a symptom; the Worker receives a bounded inspection suggestion. A supported diagnosis requires current failed-test or approved successful inspection quotes and source locations. Protected-suite defect suspicion escalates without a suite edit. There are no known automated regressions. The first focused run found old assertions that expected generic repair wording and a per-run duplicate key; these were corrected, and the final focused/full runs are green. No manual/native model session or formal controller score was run, and semantic quality of novel model diagnoses remains an evidence gap.

**P8 handoff:** consume the structured diagnosis with its task, suite, source and run identity during independent requirement review and replay; prevent stale or blocked reruns from displaying prior success or recovery. Do not treat the P7 simulated two-file fixture as native Pi qualification or Phase 1 release approval.
