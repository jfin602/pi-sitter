# Pending intervention card qualification — 2026-11-22

## Scope and source

- Baseline HEAD: `1412887` (`feat: announce test discovery and no-tests mode`). Work is uncommitted on a dirty `0.1.9` tree. Existing edits in `src/core.ts`, `src/fallback.ts`, `src/prompt.ts`, `tests/controller-context.test.mjs`, and the stage 02 advisory ledger were preserved.
- The change is limited to supervision lifecycle and transcript display. T1–T4 triggers, budgets, tool authority, fallback policy, and Worker control are unchanged.
- `src/intervention-lifecycle.ts` contains UI-independent event state. `src/index.ts` emits `pi-sitter-intervention` events and maps those events to the existing card renderer. A start entry stays in transcript position; terminal entries update its state and are not separately rendered. An orphan terminal is rendered on its own.

## Root-cause evidence

Before this change `recordTrigger` wrote a hidden trigger entry and `turn_end` awaited `diagnose` before `recordOutcome` wrote the visible card. The UI had no transcript entry to show during inference. The native Pi interactive host handles `entry_appended` for custom entries by adding a transcript component and requesting a render (`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js`, `entry_appended` handler). This supports prompt event delivery once Pi Sitter appends the start entry; it does not prove screen timing on a real interactive session.

## Checks

| Command | Result | Evidence and limit |
| --- | --- | --- |
| `npm run check` | PASS | TypeScript check completed. |
| `node --test tests/adapter.test.mjs` | PASS, 31/31 at initial run | Includes real 10-second delayed diagnosis; start and pending render happened before completion, terminal reused ID, purple style and response rendered, duplicate card suppressed. Subsequent additions are covered by the serial full run. |
| `node --test tests/adapter.test.mjs tests/intervention-lifecycle.test.mjs` | PASS, 35/35 | Final focused check includes the labeled working indicator and lifecycle reducer. |
| `node --test --test-name-pattern='Session switch aborts old diagnosis' tests/adapter.test.mjs` | PASS, 1/1 | Replayed orphan start resolves to cancellation after session switch. |
| `node --test tests/verifier.test.mjs` | PASS, 6/6 | Isolated verifier tests passed after a parallel full-suite timeout failure. |
| `npm test` | FAIL, 112/115 | Three verifier tests reached their short wall-clock timeout while all test files ran in parallel. They passed in isolation and serial full run. No verifier source was changed by this task. |
| `node --experimental-strip-types --test --test-concurrency=1 tests/*.test.mjs` | PASS, 115/115 | Entire suite including new intervention tests. |
| `npm pack --dry-run --json` | PASS | Tarball includes `src/intervention-lifecycle.ts`. |

## Live qualification gap

The requested duplicate failed tool-call scenario was reproduced in the deterministic adapter harness, including a 10-second supervisor response and a pending card rendered before that response. The native interactive Pi UI was not run with a real model and tool failure. Therefore trigger acceptance to native UI event delivery, event delivery to visible screen rendering, spinner animation, and final scroll behavior are **NOT RUN** and this is **not a live UI PASS**. Pi's existing animated working indicator is labeled for Pi Sitter during the attempt; the card itself uses a static pending marker because the custom-entry renderer exposes no motion preference or animation hook. Host animation inside the card needs qualification without a cosmetic timer.

Next action: run an installed package in an interactive Pi session, induce two equivalent failed tool calls, record both timing intervals, and inspect the pending-to-complete card transition and scroll position before closeout.

## Current Vitest full-test workspace installation

On 2026-11-22, the owner requested installation into `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01`. The source was HEAD `1412887951249ed2ad2caf2a5dbfb40f2206805f` plus the dirty working-tree changes described above; the package remains `0.1.9`. This was an install request, not a release qualification or version change.

- Packed the local source with `npm pack --json --pack-destination <temporary directory>`. Archive SHA-256: `2e436cc989245e9c8188a83a07842058de9b28b522ca85b5697205d989fd7848`. The packaged `src/` file hashes matched all 20 source files in the working tree, including `intervention-lifecycle.ts`.
- Replaced the workspace's `pi-config/packages/pi-sitter` directory with the packed snapshot. The previous installed copy is retained at `pi-config/packages/.pi-sitter-backup-20261122T170634Z`. The workspace `pi-config/settings.json` already registered `packages/pi-sitter`; it was left unchanged.
- `PI_CODING_AGENT_DIR=<workspace>/pi-config <Pi CLI> list --no-approve`: PASS, listed `packages/pi-sitter`.
- Native Pi RPC `get_commands` with the installed `src/index.ts`: PASS, exactly one `sitter` command loaded, exit 0.
- `./start-pi.sh 01 --check` in the workspace: PASS, “Stage 01 preflight passed. No Pi session or Godot editor was started.”

The workspace's `update-pi-sitter.sh` helper was not used: it currently requires a source `package-lock.json` that this repository intentionally lacks and defaults to a Pi binary path that is absent on this host. The direct package replacement preserves that helper and all unrelated workspace files. No Stage 01 run, live supervisor inference, or transcript timing check was performed by this installation.
