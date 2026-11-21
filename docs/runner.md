# Pi Sitter — Dope Codex Phase Runner

**Status:** Development-only exact Dope runner port from `jfin602/vault` (which records byte identity to `jfin602/dope` on 2026-11-21). This is NOT the Pi Sitter runtime verifier, not Vitest gate authority and not a reason to mark 1.0 qualified.

## Files and constraints

- `scripts/codex-phase-core.mjs`, `scripts/codex-phase.mjs`, `scripts/validate-codex-phase.mjs` copied without modification.
- `tests/runner/codex-phase-*.test.ts` are ported regression tests; `tests/runner/pi-sitter-runner-compat.test.mjs` protects Git blob identity and the Pi Sitter compatibility baseline.
- Logs and activity saved under ignored `.codex-runs/` in developer workspace. Dope runner owns per-prompt versioned commits and resume. Agents must not self-commit.
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

## P1 stack planning and versions

Package baseline stays `0.1.0`. Historical `p1` phase grammar assigns P1 `0.1.1`, P2 `0.1.2`, etc. Each implementation prompt updates version metadata; the runner checks version/history then owns the commit. An independently authorized final manual P6 may use `0.1.6` only on observed closeout. **No `1.0.0` tagging or publishing by the phase runner.**

**Current:** P1 is planned only. There are **no P1 prompt files to validate or execute** yet. Developer runner setup/docs do not constitute implementation or qualification. Do not run `codex:phase -- p1` until the stack exists and the owner approves execution.

See [the P1 task](tasks/p1/README.md), [workflow](workflow.md), and [qualification ledger](tasks/p1/qualification/README.md).
