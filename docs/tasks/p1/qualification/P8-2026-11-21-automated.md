# P8 automated qualification — 2026-11-21

**Basis:** clean pre-task HEAD `2f74934ee4f8f34b661d6ec03c5fc8be7cf7d555`, package `0.1.7`; assigned checkpoint `0.1.8`. Node `v24.21.0`, npm `11.19.0`. All P8 changes are uncommitted for the Dope runner. No owner work was present at start.

## Child-environment preflight before edits

- `npm run test:runner` — PASS, 110/110; disposable Git fixtures worked.
- `npm test` — PASS, 83/83; bubblewrap verifier fixture worked.

## Implementation and regression evidence

- `node --experimental-strip-types --test tests/completion.test.mjs tests/controller-context.test.mjs tests/checkpoints.test.mjs` — PASS, 37/37 before checkpoint advance. Covers complete original requirement review, source citations, missing/failed findings, >700-character requirement replay, protected gate inventory, changed task or suite, duplicate run, blocked rerun, persisted attempt behavior and checkpoint cadence.
- `npm test` — PASS, 88/88 before checkpoint advance. Includes existing trigger/mode, recovery, broker, MCP and sandbox regressions. Earlier P8 runs found an old renderer assertion that treated an unbound historical report as current and a synthetic replay entry without matching run provenance. The fixtures were corrected; the final run passed.
- `npm run test:runner` — PASS, 110/110 before checkpoint advance; original Dope runner byte identity remains protected.
- `npm run check` — PASS before checkpoint advance.
- `git diff --check` — PASS before checkpoint advance.
- After advancing `package.json` to `0.1.8` and tightening suite identity, blocked-attempt replay, status provenance, review cancellation and source-receipt custody, `node --experimental-strip-types --test tests/completion.test.mjs tests/controller-context.test.mjs tests/checkpoints.test.mjs tests/recovery-causal.test.mjs` — PASS, 42/42. The reviewer sees only a read-only broker inspection handle and copies of the task/report; a forged receipt, unsupported quote or attempted gate-result mutation cannot produce VERIFIED. Final full command results are recorded below. The root remains lockfile-free and `.npmrc` remains `package-lock=false`.

## Final post-bump verification

- `npm test` — PASS, 90/90.
- `npm run test:runner` — PASS, 110/110.
- `npm run check` — PASS.
- `git diff --check` — PASS.

## Findings and limits

The embedding host can provide an independent requirement review tied to the current trusted task, stage, milestone, source, suite and run. Positive or negative findings require an allowed source-inspection receipt and source location; absent findings are UNVERIFIED. An all-pass test report alone remains UNVERIFIED. A blocked or later attempt cannot reuse a prior report or recovery instruction as current. The callback is host-owned and absent in the ordinary standalone extension, where current VERIFIED remains unavailable. The callback's actual source-inspection quality, native model behavior, formal controller scoring, and real installed Pi/MCP behavior were not qualified here. No Phase 1 GREEN or release claim follows from these simulated fixtures.

**P9 handoff:** qualify this uncommitted P8 implementation after the runner's versioned commit in packed installations across unrelated projects, including a non-Godot fixture; exercise a real host-backed source inspection review, protected Vitest run, failed-gate recovery and fresh rerun. Verify task/suite/run replay and blocked rerun in a real Pi session. Preserve manual/native and owner formal closeout for P10.
