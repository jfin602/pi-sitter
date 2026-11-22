# P9 headless qualification and P10 manual handoff

**Date:** 2026-11-21. **Basis:** pre-task HEAD `0ca9bee848a3beb4de5b5e7f99cfdee832f9d52a`, clean working tree, `pi-sitter@0.1.8`. **Result:** uncommitted P9 implementation at assigned `0.1.9`; the Dope runner owns staging and the implementation commit. This is headless evidence, not Phase 1 GREEN or 1.0 release qualification.

## Environment and exact automated checks

Node `v24.21.0`, npm `11.19.0`, installed Pi peer `@earendil-works/pi-coding-agent@1.5.2`, `typebox@1.4.7`, TypeScript `5.9.3`, Linux with working bubblewrap fixture. The two `npm install` consumers use the pinned Pi/typebox peer versions and `--offline --ignore-scripts --no-audit --no-fund --no-package-lock`. No root lockfile exists; `.npmrc` SHA-256 is `f3fc23758ab91be5f94a8c5eaff433d1ccd6a206cf1d381d332eb63716009337` (`package-lock=false`).

| Exact command, run in Codex child at repository root | Observed result |
| --- | --- |
| `npm run test:runner` before editing | PASS, 110/110; disposable Git fixture operations worked |
| `npm test` before editing | PASS, 90/90; bubblewrap verifier fixture worked |
| `node --experimental-strip-types --test tests/headless-integration.test.mjs` first focused run | FAIL, fixture mistakenly included manifest gates in the reporter's suite identity; packed installs already passed. Corrected the fixture, no production source changed. |
| `node --experimental-strip-types --test tests/headless-integration.test.mjs` focused rerun | PASS, 9/9, including two tarball installs and two complete deterministic flows |
| `npm run check` before version bump | PASS, TypeScript no-emit check |
| `npm test` before version bump | PASS, 99/99, including T1–T4, mode, cancellation, MCP, sandbox, report and replay regressions |
| `npm run test:runner` before version bump | PASS, 110/110; runner SHA and lockfile policy checks passed |
| `npm pack --dry-run` before version bump | PASS; `pi-sitter@0.1.8`, `src/index.ts` included; 61 payload files. Final `0.1.9` dry run is recorded in the post-bump addendum below. |

Original Dope script SHA-256, unchanged in this tree: `scripts/codex-phase-core.mjs` `2d4eebe155a6799e9d6c3778c8d398051a2ae3d7399dd0c8e5c833ae18504f59`; `scripts/codex-phase.mjs` `3a1ebda4bb34e2b3f5f79cd04fab133499753680449339b345546f9c03559cdc`; `scripts/validate-codex-phase.mjs` `5cd0d0a00f0e5200cea83268042db0cc005e8c72920cd32c9f6ea15015e102fd`. No runner script or authored P1–P10 prompt text was edited.

## What the headless fixtures prove

`tests/headless-integration.test.mjs` installs a real `npm pack` tarball into separate temporary TypeScript invoice and Python slug consumer projects. Both declare the actual Pi 1.5.2 and typebox 1.4.7 peers. Pi's `DefaultResourceLoader` binds the extension from each consumer's own `node_modules/pi-sitter/src/index.ts`, registers `/sitter`, and starts with zero messages. The consumer does not reference the repository source path. Fixture JSON SHA-256: TypeScript `dd51e0bfaefbc7285fb74e81b33e9e69c0139117df10487caf15a6b05998a944`; Python `06fc8c1cd5b9406c5800997777230cbcb5b3e0859812f580059cd21906ea75ef`.

For each project, the test creates an authored task and protected manifest with two gates, hashes the saved project through `EvidenceBroker`, and submits a known failed assertion through `adaptVitestReport` and `normalizeGateReport`. The failure is `RECOVERY_REQUIRED`. `runInspectionAnalysis` makes one scoped source inspection and accepts a cited repair plan. The **test harness represents the worker** when it writes the repaired source. A fresh snapshot and `post_repair` checkpoint retain the regression gate; both gates then pass. Completion remains `UNVERIFIED` until a separate current-source inspection receipt supports every authored requirement, after which the advisory decision is `VERIFIED`. The external controller's formal score is not simulated or claimed.

The Vitest JSON reporter payload and model answers are deterministic **simulation**, not a Vitest CLI process or a live model. The packed extension load is genuine Pi 1.5.2 package-loader execution, but no interactive Pi session, native supervisor model call or production MCP service was run. The controlled MCP unit fixture and Linux bubblewrap tests are separate existing evidence, not native end-to-end qualification.

Negative assertions fail closed for stale source identity, empty/corrupt/unknown/spoofed Vitest rows, duplicate run identity, blocked rerun, missing requirement review, malicious `readOnlyHint` on a write tool, nested and shell routing through an approved read name, and an invalid verifier sandbox plan. Existing regression tests also cover skipped reports, actual sandbox failure/crash/timeout, source/suite mutation denial, network denial, cleanup, stale replay, and T1–T4 behavior. These tests do not prove that every host sandbox or MCP server is supported.

## P10 owner handoff: repeatable manual closeout

P10 is the existing `Browser required: yes.` manual interlock in `P10-manual-real-pi-mcp-closeout.txt`. The unchanged Dope runner must not auto-execute it, including with `--closeout`. Owner review starts only after the runner commits P9 and reconciles this ledger with that commit.

1. Record the committed P9 SHA, clean/dirty status, OS, Node/npm/Pi 1.5.2 version, selected supervisor model, installed `pi-sitter` path and hash, controlled project paths, trusted controller identity, protected suite digest and MCP server identities. Use disposable TypeScript and Python projects, not owner production work. Reproduce `npm pack --dry-run`, `npm run check`, `npm test` and `npm run test:runner` at that SHA.
2. Install the packed `0.1.9` package in both projects with the declared Pi/typebox peers. In an actual interactive Pi session, confirm extension discovery from installed `src/index.ts`, `/sitter` commands, Off/Shadow/Active behavior, idle silence, T1–T4 thresholds, duplicate suppression, natural-turn delivery, cancellation and session resume. Save Pi transcript and invocation log.
3. Use a host-approved protected Vitest suite outside Worker write scope. Record manifest digest, source snapshot and run IDs. Exercise pass, attributable assertion failure, skipped/missing test, malformed report, suite/source drift, milestone subset, final full coverage and post-repair rerun. Confirm the Worker can repair implementation but cannot edit scored tests. Verify all-green tests plus an uninspected authored requirement remain `UNVERIFIED`.
4. If the host can attest MCP server identity and supply a vetted independent read dispatcher, compare an actual Worker read with a Sitter read of the same scoped resource. In a controlled non-destructive server, attempt write/edit/command, nested/deferred/codemode and out-of-scope resources; capture host refusal and unchanged Worker permissions. If the host lacks this adapter, record MCP as **NOT RUN/EVIDENCE GAP**; do not expose direct tools based on annotations or names.
5. Run the approved verifier on a host with working bubblewrap namespaces and `prlimit`. Confirm protected source/suite writes and network are denied, scratch works, and timeout/cancel cleans up. On unsupported hosts (including namespace-denied Linux or non-Linux without an equivalent host runner), record **BLOCKED**; do not disable isolation. Check install/uninstall cleanup and stale report/replay after a blocked rerun.
6. Append `p10-native-closeout.md` with exact commands, source/suite/run IDs, transcripts/artifacts, R01–R11 case status and explicit owner ACCEPT/HOLD. Stop and route a separate correction if a mutating MCP call escapes, sandbox confidentiality fails, a missing gate becomes VERIFIED, or stale evidence appears current. Do not tag, publish, or infer 1.0 approval.

**Known gaps:** no general independent MCP connected-server attestation in ordinary installs; no live model-driven supervisor qualification; sandbox requires Linux bubblewrap/prlimit and has a documented short create/delete file-count race; the host must attest source/suite identities and supply a requirement reviewer; no formal controller outcome or owner signoff. R11 remains **NOT RUN**. Headless R10 is supported by the packed-install fixtures, with native multi-project operation still **EVIDENCE GAP**.

## Post-bump addendum

After the required automated checks passed, `package.json` advanced from `0.1.8` to `0.1.9`. On the resulting dirty tree, `npm run check` passed; `npm test` passed 99/99, including both fresh `0.1.9` tarball installs; `npm run test:runner` passed 110/110; and `npm pack --dry-run --json` passed with `pi-sitter-0.1.9.tgz`, 62 payload entries, and `src/index.ts` at the declared extension path. The dry-run also lists this ledger in the payload. No root `package-lock.json` was created. These are pre-commit working-tree results; the runner must verify its own committed tree.
