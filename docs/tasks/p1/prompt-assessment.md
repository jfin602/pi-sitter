# /prompt-ass p1 — Pi Sitter 1.0 Architecture and Safety Assessment

**Status:** AUTHORED / NOT EXECUTED; assessment is source-grounded, not 1.0 qualification.  
**Owner request:** `/prompt-ass + /prompt-plan + /prompt-write p1`; ten-prompt design approved as nine implementation checkpoints and one manual closeout.  
**Baseline:** main `d028500bc5d79638e9093d964e919d3a978f021f` (`pi-sitter@0.1.0`); [ADR Q1–Q10](../../decisions/0001-ten-approved-decisions.md), [A01–A12 source audit](codebase-gap-audit.md), [source-anchored plan](implementation-plan.md).  
**Release:** 1.0.0 is separately qualified and owner authorized, not an automatic phase checkpoint.

## Source-backed starting truth

- The Pi extension already loads through `pi.extensions = ./src/index.ts`; current `src/core.ts` implements T1–T4 trigger behavior with a finite budget, deduplication and quiet on-demand intervention. `src/supervisor-session.ts` currently exposes only `pi_sitter_inspect` and **rejects direct MCP access**.
- `src/gates.ts` has schemaVersion 1 reports without trusted expected mandatory suite/test provenance. `src/completion.ts` counts **reported** gates and can return `VERIFIED` for an omitted mandatory gate or uninspected accessibility requirement.
- `src/core.ts setTask` truncates task text to 700 characters, losing original requirements. `src/verifier.ts` uses a host-owned command and bwrap but mounts host `/` read-only and does not parse structured Vitest assertion failure from nonzero process exits. The injected verifier path also needs the same mandatory validation.
- `src/index.ts` replay/status card and recovery state are not bound to a single task+suite+source+attempt and can display stale reports. The existing `src/broker.ts` has bounded snapshot checks worth retaining, but capture-time budgets and receipt provenance are incomplete.
- No runtime llm-zone/Meteor Dodge scoring dependency is observed. Tool receipt/classifier assumptions include scene names; generic `edit`/`write` text receipts may classify UNKNOWN. **Q1 explicitly requires preserving existing triggers**, not broadening them silently.
- The exact imported Dope scripts are byte-identical to Vault originals; runtime remains independent of development runner.
- Baseline [GitHub Actions 44943269353](https://github.com/jfin602/pi-sitter/actions/runs/44943269353) passed 109 runner tests, 47 Pi Sitter extension tests, typecheck, and pack dry-run on old source. This is NOT proof of new vNext acceptance or real Pi/MCP.

## Important authoring / CI incompatibility

`tests/runner/pi-sitter-runner-compat.test.mjs` currently requires **zero P1 prompt files and package version exactly 0.1.0**. Authoring the very P1 prompt files requested by the owner makes the former assertion fail in CI before P1 executes. The latter will fail as soon as P1 produces 0.1.1. **This authoring action does not modify test code.** P1 explicitly fixes both temporary assumptions while retaining original runner bytes, synthetic 0.1.0 fixture and no-lockfile discipline. The newly authored stack is therefore **not yet CI GREEN** on the unmodified source. This is a known F0-R gate, not a reason to fake a successful preflight.

## Prompt decomposition — audit coverage

| Prompt | Scope | Findings | Intended checkpoint |
| --- | --- | --- | --- |
| P1 | Transition-safe runner CI and freeze existing trigger goldens | A01 A02 | 0.1.1 |
| P2 | Controller-owned full task and required gate/test suite manifest | A03 | 0.1.2 |
| P3 | Strict Vitest normalization + early false-success blocking | A04 A10 (early) | 0.1.3 |
| P4 | Isolated approved runner, milestone/final/post-repair runs | A05 A06 | 0.1.4 |
| P5 | Worker MCP read discovery and host-side filtering | A07 | 0.1.5 |
| P6 | Bounded snapshot capture and trustworthy receipts | A08 | 0.1.6 |
| P7 | Evidence-specific structured recovery | A09 | 0.1.7 |
| P8 | Independent full requirement audit, run-bound reports/replay | A10 A11 | 0.1.8 |
| P9 | Cross-project packed install and headless qualification | A12 | 0.1.9 |
| P10 | Real installed Pi/MCP manual native closeout | A12 | 0.1.10 (manual only) |

All twelve items have explicit primary owners and negative test gates. Prompt numbers are *runner checkpoints*, while the conceptual ROADMAP F0-R/P1–P6 are workstreams.

## Risks and hold conditions

1. **Critical false-positive completion** — mandatory missing gate or uncovered requirement cannot return VERIFIED. Sentinel required by P3; full requirement matrix P8. The manifest must originate from a trusted controller, never the worker or supervisor.
2. **Unsettled public wire design** — candidate task/manifest ingress and legacy v1 handling need explicit owner design review before treating as stable public API. Prompts may implement minimal versioned internal adapters, but cannot fabricate owner-approved public schemas.
3. **Safety and provider diversity** — readOnlyHint is untrusted; Pi 1.5.2 getActiveTools is not a full revocation boundary, and separate Pi sessions do not load built-in MCP automatically. Deny unvetted nested operations. Sandbox must not read entire host root.
4. **Trigger integrity** — event naming/classification and configurable advisory budget 16 versus history cap 16/config max 32 are documented issues; no change without separate owner authorization.
5. **Version/CI transition** — no root package-lock; P1 test fixes are mandatory before a fully green prompt-authored branch. Only original Dope runner may commit checkpoints.
6. **Truthfulness** — no manual Pi model/MCP/real repair claims from synthetic CI tests. No Git commit or documentation milestone closes R01–R11 alone.

## Decisions deferred outside this prompt stack

No package publish/tag or 1.0 release, no llm-zone benchmark uplift scoring, no acceptance-test authoring by Pi Sitter, no arbitrary worker permissions, no proactive always-on supervisor, no changes to original trigger behavior without owner consent.

**Review gate:** owner should review this assessment, implementation plan and all ten prompt files before separately authorizing `npm run codex:phase -- p1`. Generating files does not execute them.
