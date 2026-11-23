# Pi Sitter — Dope Codex Phase Runner

**Status:** Development-only exact Dope runner port from `jfin602/vault` (which records byte identity to `jfin602/dope` on 2026-11-21). This is NOT the Pi Sitter runtime verifier, not Vitest gate authority and not a reason to mark 1.0 qualified.

**2026-11-23 owner milestone:** The owner authorized a `0.2.0` package checkpoint and direct Git commit/push after a live Stage 04 host diagnostic passed 51/51. The historical `p1` prompt versions and Dope runner scripts stay unchanged. The live manifest compatibility test accepts this specific owner checkpoint in addition to historical `0.1.x` versions. The diagnostic does not close P10 or qualify `1.0.0`.

## Files and constraints

- `scripts/codex-phase-core.mjs`, `scripts/codex-phase.mjs`, `scripts/validate-codex-phase.mjs` copied without modification.
- `tests/runner/codex-phase-*.test.ts` are ported regression tests; `tests/runner/pi-sitter-runner-compat.test.mjs` protects Git blob identity and the Pi Sitter compatibility baseline.
- Logs and activity saved under ignored `.codex-runs/` in developer workspace. Dope runner owns per-prompt versioned commits and resume. Agents must not self-commit.
- The runner starts a separate `codex exec` process for each prompt. That child reads Codex's trusted project configuration. This repository's `.codex/config.toml` grants the child full local execution so the developer test suite can create disposable Git repositories and the existing bubblewrap verifier test can create its network namespace. Use this configuration only in a trusted development environment; it does not change Pi Sitter's runtime verifier or authorize release.
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

## Execution environment and checkpoint preflight

Before authoring or launching a prompt stack, list every mandatory command and the host operations it needs. This stack requires disposable Git staging/commits in `npm run test:runner` and a bubblewrap network namespace in `npm test`. A passing outer-terminal test is insufficient: the prompt worker runs in a separate Codex CLI process with its own sandbox policy. On a trusted project, Codex loads `.codex/config.toml`; an explicit CLI setting or managed policy can override it. See [Codex config precedence](https://learn.chatgpt.com/docs/config-file/config-basic) and [sandbox behavior](https://learn.chatgpt.com/docs/agent-approvals-security).

Check the actual child execution context before implementation begins. If Git fixture operations return `EPERM` or bubblewrap cannot create a namespace, correct the development environment and rerun the mandatory tests there. Do not waive the tests, alter Pi Sitter's verifier isolation, or advance the package version to satisfy the runner. The runner's final `Expected package version ...` error is then a *secondary checkpoint failure*: the worker correctly held the prior version because required evidence was red.

Each authored implementation prompt must state its exact target version, prior checkpoint, mandatory automated checks, and the rule to bump `package.json` only after those checks pass. It should require a post-bump check of the live checkpoint and preserve failed evidence. Manual Pi/MCP qualification remains a separate gate. The runner alone verifies the target version and commits. If a prompt fails, recover the dirty implementation and evidence first, then resume the same prompt; never pre-bump later versions.

## P1 stack planning and versions

Package baseline stays `0.1.0`. Historical `p1` phase grammar assigns P1 `0.1.1`, P2 `0.1.2`, etc. Each implementation prompt updates version metadata; the runner checks version/history then owns the commit. An independently authorized final manual P10 may use `0.1.10` only after observed native closeout; P1–P9 target `0.1.1` through `0.1.9`. **No `1.0.0` tagging or publishing by the phase runner.**

**Current (2026-11-21):** P1–P3 are committed through `1ae5075`; P4 automated checks passed at uncommitted package `0.1.4`, pending the runner's checkpoint commit. P5–P9 remain unexecuted; P10 remains manual. The original Dope scripts and their byte-identity checks remain unchanged. See the [P4 automated ledger](tasks/p1/qualification/P4-2026-11-21-automated.md).

See [the P1 task](tasks/p1/README.md), [workflow](workflow.md), and [qualification ledger](tasks/p1/qualification/README.md).
