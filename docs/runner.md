# Pi Sitter — Dope Codex Phase Runner

**Status:** Development-only exact Dope runner port from `jfin602/vault` (which records byte identity to `jfin602/dope` on 2026-11-21). This is NOT the Pi Sitter runtime verifier, not Vitest gate authority and not a reason to mark 1.0 qualified.

## Files and constraints

- `scripts/codex-phase-core.mjs`, `scripts/codex-phase.mjs`, `scripts/validate-codex-phase.mjs` copied without modification.
- `tests/runner/codex-phase-*.test.ts` are ported regression tests; `tests/runner/pi-sitter-runner-compat.test.mjs` protects Git blob identity and the Pi Sitter compatibility baseline.
- Logs and activity saved under ignored `.codex-runs/` in developer workspace. The **current imported** Dope runner owns per-prompt versioned commits and resume; agents must not self-commit. Its fixed assigned-version grammar is now **superseded policy** and needs a separately qualified migration before affected stacks run.
- Use Node **24** for developer runner TS tests and the Codex CLI. Pi Sitter extension runtime `node >=22` remains unchanged.
- Repo root intentionally uses **no `package-lock.json`**; exact runner refuses one before, during and after execution. `.npmrc` sets `package-lock=false`. This reduces dependency reproducibility; qualify resolved dependency versions on each run. Do not silently delete new owner lockfile/data.

## Commands

```bash
npm install --ignore-scripts --no-package-lock
npm run test:runner
npm run check
npm test
# Once a complete P1 prompt stack is separately authored and approved:
npm run codex:phase:validate -- p1
# Only after separately authorized implementation execution:
npm run codex:phase -- p1
```

Dope runner does NOT support `--dry-run`, `--preflight`, `--resume-dirty`, `--model`, or `--reasoning`. Optional `--verbose` and `--closeout` are available, but manual closeout must remain blocked by the final prompt's `Browser required: yes.` sentinel. This sentinel stops automation, **not** a substitute for real Pi/MCP qualification.

## Versioning transition — legacy P1 checkpoints superseded

**Owner-approved target:** [change-driven versioning](VERSIONING.md) / [ADR 0002](decisions/0002-change-driven-versioning.md). The previously assigned P1 `0.1.1`, P2 `0.1.2`, … P10 `0.1.10` are **historical authoring assumptions, not valid future release assignments**. The next successful repository-mutating prompt must advance exactly one patch from the *actual* starting version, independent of phase.

**Current implementation is still legacy:** the unmodified imported Dope runner checks fixed prompt-assigned versions and commit history; P1–P10 texts and `tests/runner/pi-sitter-runner-compat.test.mjs` still encode those assumptions (including fixed `0.1.0` and zero-file checks). Do not alter canonical Dope runner bytes casually or weaken safety/identity tests just to force GREEN. A wrapper/replacement or separately approved runner change must preserve the commit/resume safeguards and manual closeout interlock, with idempotent version checkpoint proof.

**Execution hold:** P1–P10 are **AUTHORED, NOT EXECUTED**. **Do not run `npm run codex:phase -- p1`** until the runner/version tests and executable prompts are migrated, validated, independently qualified, and approved for execution. This documentation-only policy does not update package `0.1.0`, establish a green CI result, tag or publish `1.0.0`.

See [the P1 task](tasks/p1/README.md), [workflow](workflow.md), and [qualification ledger](tasks/p1/qualification/README.md).
