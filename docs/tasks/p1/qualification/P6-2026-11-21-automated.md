# P6 automated qualification — 2026-11-21

**Basis:** clean pre-task HEAD `dcb942b7ae2de842b94da364d58f79fa6ce4c13c`, package `0.1.5`. Implementation remains uncommitted for the Dope runner. Target package checkpoint: `0.1.6`.

## Child-environment preflight

- `npm run test:runner` — 110/110 passed, about 1.98 seconds. Disposable Git fixture operations worked.
- `npm test` — 76/76 passed, about 1.00 seconds. Bubblewrap verifier fixture worked.

## Implementation evidence before version advance

- `node --experimental-strip-types --test tests/broker-evidence.test.mjs tests/analysis.test.mjs tests/mcp-read.test.mjs tests/mcp-pi-integration.test.mjs tests/safety.test.mjs` — 12/12 passed, 0.55 seconds. Includes TS/Rust/Python broker coverage, scoped reads, symlink/traversal and stale-source denial, copied-file limit, provider error/output flood denial, MCP scope redirect denial and the real Pi fixture.
- `npm run check` — passed.
- `npm test` — 80/80 passed, about 1.16 seconds, including verifier isolation fixtures.
- `npm run test:runner` — 110/110 passed, about 2.70 seconds.
- After advancing `package.json` to `0.1.6`: `npm run check` passed; `npm run test:runner` passed 110/110 in about 2.02 seconds; `git diff --check` passed and no root `package-lock.json` exists.
- After a receipt refinement for denied broker reads: `npm test` passed 80/80 in about 1.09 seconds and `npm run check` passed. Earlier failed focused assertion was a test mistake about a synchronous closed-snapshot throw; corrected and rerun 12/12. No unresolved automated regression.

## Limits and remaining qualification

Capture deadline 35 seconds, file 2 MB, snapshot 50 MB, 5,000 files; broker inspection 35 seconds, eight requests and 64,000 characters total; MCP dispatch 15 seconds, 20 calls, 4,096 argument characters and 16,000 result characters. Failed or stale captures are removed. Scope lists and source/server attestation are supplied by the host; this automated fixture does not qualify arbitrary connected services or a native model-driven supervisor turn. The host must provide current task/gate resource scope and independently attest the connected server. Formal release and native qualification remain open for P10. P7 receives scoped, digest-bound research evidence and must keep denied/error text outside recovery support.
