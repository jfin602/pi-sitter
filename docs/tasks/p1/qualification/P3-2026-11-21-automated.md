# P3 automated qualification — 2026-11-21

**Basis:** clean pre-task HEAD `c34da23155d5f6fc23ce05443a58e790add4afcd`, package `0.1.2`; target package `0.1.3`. Dope runner owns the implementation commit. No release or Phase 1 closeout claim.

## Commands and observed results

- Child preflight: `npm run test:runner` — 110 passed, exit 0; `npm test` — 60 passed, exit 0. Both disposable Git and bubblewrap fixtures worked in this child environment.
- Focused: `node --experimental-strip-types --test tests/vitest-report.test.mjs tests/controller-context.test.mjs tests/verifier.test.mjs tests/completion.test.mjs` — 34 passed, exit 0 on final source.
- After implementation and before version advance: `npm run check && npm test && npm run test:runner && git diff --check` — exits 0; 64 runtime tests, 110 runner tests, no diff whitespace errors. After the `0.1.3` checkpoint and final focused additions, the same command chain ran again with exits 0: 66 runtime tests, 110 runner tests.
- Real Vitest 5.1.1 installed in the disposable npm exec cache: `npm exec --yes --package=vitest@5.1.1 -- vitest --version` — `vitest/5.1.1`; in `/tmp/pi-sitter-vitest-p3`, `vitest run sample.test.mjs --reporter=json --outputFile=/tmp/pi-sitter-vitest-p3/report.json --no-file-parallelism` — exit 1 from one assertion failure; `vitest run pass.test.mjs --reporter=json --outputFile=/tmp/pi-sitter-vitest-p3/pass.json --no-file-parallelism` — exit 0. Feeding both reporter JSON objects through `adaptVitestReport` and `normalizeGateReport` produced `EXPORT:PASS,A11Y:FAIL` and `EXPORT:PASS,A11Y:PASS`, respectively. The temp fixture and reports are local inspection evidence, not durable release artifacts.

The schema 1 command fixture was revised to emit the trusted schema 2 contract. The explicit schema 1 historical completion regression remains. Subprocess tests cover exit 1 assertion failure, exit 2 crash classification, malformed JSON and an abort-signal timeout; injected-path tests cover invalid counts before persistence or recovery.

## Limits and handoff

The controller and runner identities are compared with host-supplied facts; this phase does not authenticate the host or independently hash source/suite content. Vitest JSON is consumed through a host wrapper envelope carrying task/run/suite/source identities. The existing verifier sandbox still binds the host root read-only and has no narrow source/suite mounts or resource policy. P4 receives the strict report boundary and existing host-approved command path, and must implement scoped isolation, cleanup and checkpoint cadence without weakening report checks or trigger behavior. All-pass tests remain `UNVERIFIED` pending the P8 independent requirement audit. No native Pi/MCP, formal acceptance, release or publication gate was run.
