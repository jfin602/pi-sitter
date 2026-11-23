# /prompt-plan p1 — Source-grounded Pi Sitter implementation and qualification

**Status:** AUTHORED / PROMPTS NOT EXECUTED / 1.0 NOT QUALIFIED.  
**Basis:** [assessment](prompt-assessment.md), [gap audit](codebase-gap-audit.md), [Q1–Q10](../../decisions/0001-ten-approved-decisions.md).  
**Version contract — SUPERSEDED (2026-11-23):** Original P1–P9 fixed `0.1.1`–`0.1.9` and P10 `0.1.10` targets are historical only. [ADR 0002](../../decisions/0002-change-driven-versioning.md) approves the *next actual patch per successful mutation prompt* rather than phase-linked assignments. **Execution is on HOLD** until runner, tests and executable prompt texts migrate; `1.0.0` remains independently owner-authorized.

## Dependency order (the nine bounded implementation prompts)

**P1 — F0-R: CI transition + trigger preservation (T1).** Update only `tests/runner/pi-sitter-runner-compat.test.mjs` and trigger fixtures. Keep three Dope SHA identity checks and synthetic initial 0.1.0 fixture; make live package/stack tests dynamically validate legitimate checkpoints and the P10 browser-required interlock. Characterize T1 two equivalent failures, T2 setup/discovery counts, T3 configured final validator, T4 no-progress/inspection. Preserve Off/Shadow/Active, cancellation/resume/dedup. No trigger change or 16/32 budget fix.

**P2 — Trusted task and manifest (T1).** Introduce host-owned immutable task/required requirement IDs, versioned suite digest, required gate/test IDs and source identity. Preserve full original task beyond 700 chars across task and session lifecycle while bounding only model-facing prompts. The worker may author dev tests but cannot rewrite scored suite. Disallow omitted gate to pass; historical v1 only historical. Final external public wire API remains for review.

**P3 — Unified Vitest-first report path (T1).** Strict generic validator for both injected and subprocess reports before recording, completion and UI. Parse structured Vitest outcomes including normal nonzero assertion exits, counts, IDs and locations; do not confuse assertion FAIL with crash/timeout BLOCKED. Enforce suite/source/run completeness, skipped/duplicates/malformed negative tests. Enforce early A10 false-success sentinel; P8 owns complete independent requirement review.

**P4 — Constrained execution and cadence (T2).** Replace host-wide read bind with least-privilege protected suite/source/runtime mounts, disposable scratch, resource limits and cleanup. Trusted checkpoint reason milestone/final/post_repair/manual, correct subset coverage, fresh source, no every-edit checks. Missing isolation blocks; preserve existing worker triggers.

**P5 — Real safe MCP discovery (T2).** Inspect pinned Pi 1.5.2 host/MCP API, connect to worker's configured services but expose only verified host-approved read operations. Deny arbitrary shell, mutation, nested and deferred/codemode paths; readOnlyHint alone proves nothing. Preserve independent supervisor session and snapshot-only fallback; prove actual read parity with safe fake MCP.

**P6 — Evidence custody (T1).** Bound capture-time work, source-copy digest, provider result sizes and receipt IDs. Ensure a denied/out-of-scope/stale call cannot become evidence; preserve TS/Rust/Python generic coverage. No write path.

**P7 — Structured causal recovery (T1).** Require evidence from failed assertion or current approved inspection, uncertainty/confidence, affected files/functions, ordered repair steps and approved rerun request. Unsupported root causes abstain; worker executes and Sitter becomes idle.

**P8 — Requirement-level review and replay (T2).** Independently score every original authored requirement as VERIFIED/FAILED/UNVERIFIED with supporting current-source evidence. Combine complete accepted gate manifest with requirement coverage to determine current advisory completion. All reports/cards/replay/recovery use the same task+milestone+source+suite+run; blocked rerun cannot show stale success; old v1 labeled history.

**P9 — Headless integration, packaging and owner handoff (T2).** Actually install packed extension into two unrelated project fixtures incl. non-Godot; simulate deterministic failure→research→worker repair→approved rerun→requirement coverage; real negative MCP and sandbox cases; full typecheck/test/runner/pack and source-bound qualification ledger. Explicitly mark live model/MCP/manual NOT RUN.

## P10 — Independent manual Pi/MCP closeout (T3)

Owner starts this separately in a real installed Pi session after inspecting P9 evidence. Test actual model sessions, on-demand triggers, safe MCP read parity, blocked mutation and nested calls, protected Vitest gates, recovery, task requirement truth, stale replay and install cleanup in controlled projects. Record exact environment, source, commands, artifacts and R01–R11 status; owner decides ACCEPT/HOLD. `Browser required: yes.` is a deliberate runner interlock; **do not** auto-run P10, including with --closeout, or publish/tag 1.0.0.

## Gates and efficiency

- P1–P3: focused tests + typecheck; target counterexamples first; avoid unrelated repo-wide refactoring.
- P4–P6: focused sandbox/MCP security tests and existing adapter tests. DENY-DEFAULT if platform unsupported; no unsafe fallbacks to achieve GREEN.
- P7–P8: concrete evidence linkage, existing trigger goldens and past-report replay matrix; false VERIFIED blocks the sequence.
- P9: full deterministic test matrix, `npm pack --dry-run`, CI scope and recorded command proof; P10: real manual observations only.
- Under the approved target, successful prompts retaining project changes advance one next-patch checkpoint; failed/blocked/partially dirty work must be reconciled, and retries/resume must not double-bump. The old runner's fixed assignment behavior is **not yet migrated**; do not execute the historical prompts until versioning transition tests pass.
- Do not touch original Dope runner scripts or root package-lock.json; keep executed prompt files immutable; append corrections and failed qualification evidence rather than rewriting.
- No implicit scope expansion: owner-approved Q1 preserves current triggers; llm-zone owns formal benchmark criteria and scores.
- **Authoring caveat:** until P1 test-only transition fix executes, current CI's 'zero prompt files' check is expected to fail on an authored P1 stack. This is not waived or labeled green.

## Final deliverable definition

Nine independently checkpointed code changes and one manual review, with complete A01–A12 coverage, source-bound evidence, no missing-gate false success, no supervisor mutation permissions, real Pi/MCP proof and owner release disposition. Headless success alone is not Pi Sitter 1.0 acceptance.

[Prompt assessment](prompt-assessment.md) · [Audit A01–A12](codebase-gap-audit.md) · [Qualification ledger](qualification/README.md).
