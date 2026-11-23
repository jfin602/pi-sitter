# Intervention directives — local implementation qualification

## Owner-authorized 0.2.0 checkpoint — 2026-11-23 local

The owner selected `0.2.0` after the Stage 04 host diagnostic passed and separately authorized a Git commit and push. The pre-check package was `0.1.9` on HEAD `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b` with dirty source, tests, and documentation. The new package version was set only after `npm run check:all` passed at `0.1.9` (152/152 runtime and 110/110 developer-runner tests). The initial `0.2.0` check exposed an old tarball test restricted to `0.1.x` (149/150 tests reached, one failed before its two nested installed-package cases); the test now compares the tarball and both installed manifests with the live package version. No production behavior or Dope runner script was changed to resolve that mismatch.

| Exact command | Outcome on final `0.2.0` tree |
| --- | --- |
| `npm run check:all` | PASS; TypeScript check, 152/152 runtime tests, 110/110 developer-runner tests |
| `npm pack --dry-run --json` | PASS; `pi-sitter@0.2.0`, 80 files, 169744-byte tarball |
| `git diff --check` | PASS; no whitespace errors |

The live 51/51 result below is a benchmark host diagnostic. Protected final acceptance, independent requirement review, and P10 manual closeout remain open; this checkpoint is neither a `1.0.0` release nor npm publication.

## Live Stage 04 diagnostic pass — 2026-11-23 local

The owner-requested fresh Stage 04 run is recorded at `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/04/2026-11-23T13-01-22-367Z_01a2087f-2e3e-7274-8b10-3445a0d50525.jsonl`. On the installed dirty `0.1.9` package from source HEAD `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b`, the first completion diagnostic returned `FAIL`, 50/51, with only `MD-METEOR-ROOT` failing. The Worker changed the existing Meteor scene root from `meteor` to `Meteor`, inspected the saved file, and handed off again. The second diagnostic returned `PASS`, 51/51, with no failed check IDs. The reset and preflight that preceded this run are recorded in the benchmark workspace at `sessions/archives/pre-stage-04-rerun-after-stage-05-2026-11-23T12-55-36Z/reset-ledger.md`.

This demonstrates a successful live advisory diagnostic and repair continuation for this one Stage 04 run. The benchmark host diagnostic is separate from protected Pi Sitter verification: the Worker account can access the candidate suite, and no trusted protected controller or independent requirement review ran. No formal `VERIFIED` result or general repair reliability claim follows from this 51/51 result.

## Owner-requested clean Stage 04 rerun setup — 2026-11-22 local

The preceding Stage 04 game, installed package, cache, and transcript were archived at `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/archives/pre-stage-04-fresh-rerun-2026-11-23T04-17-29Z/workspace.tar.gz` (SHA-256 `5f8c985485ad97a4166565c764762548c3ff0c1e12c06bcdafe6bbc7c27535d0`). No Pi or project editor process remained. Restored nine game files byte-for-byte from the established Stage 03 baseline, removed `scripts/main.gd` and generated cache, then installed current dirty Pi Sitter `0.1.9` source on revision `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b` (previous and target versions both `0.1.9`). `./update-pi-sitter.sh` passed type checking and 147/147 runtime tests; installed `src/index.ts` matches source. `/home/jfin/.local/bin/godot --headless --path . --editor --quit` exited 0; `./start-pi.sh 04 --check` passed. The host wrapper retains the per-run suite fingerprint correction. No Worker run was launched after this reset; host diagnostic and protected acceptance remain unqualified for the next run.

## Per-run host-suite fingerprint correction — 2026-11-22 local

The fresh Stage 04 transcript is `sessions/04/2026-11-23T04-06-01-171Z_01a20695-0cd3-72c9-b683-2117257716b6.jsonl`. The Worker final response was followed immediately by the muted diagnostic pending entry, then `DIAGNOSTIC BLOCKED: host suite changed during the diagnostic`. Vitest created `node_modules/.vitest-cache/_manifest-meteor-dodge-v1-cffeac92.json` during that run. The separate `BLOCKED: Trusted controller task and protected suite are not configured` entry has `milestoneId: manual` and came 21 seconds later from `/sitter verify`; it is an expected protected-verification boundary in this benchmark, not the host diagnostic result.

The benchmark-owned `pi-config/host-diagnostic.mjs` now hashes the current suite inputs at the beginning of **each** diagnostic, checks that same fingerprint just before execution and after Vitest returns, and ignores only Vitest's generated `node_modules/.vitest-cache` and `node_modules/.vite` directories. Actual suite inputs and installed dependencies remain in the hash. A developer may update the host suite between runs without being vetoed by the old process-start fingerprint; changes to hashed inputs during an individual run still block that run. This does not grant Pi Sitter authority to define or modify acceptance criteria.

| Exact check | Result |
| --- | --- |
| `node --check pi-config/host-diagnostic.mjs` in test workspace | PASS |
| Same Node process: `runHostDiagnostic('04', project)` before and after a temporary host-suite file was added between runs | Both returned attributable `FAIL`, 48/51, not `BLOCKED` |
| Same Node process: add a temporary host-suite file 500 ms into a running diagnostic | Returned `BLOCKED: host suite changed during the diagnostic; result blocked` |
| Temporary test file cleanup | PASS; no marker remains in the suite |

The current 48/51 host failures are `MD-METEOR-ROOT`, `MD-SPAWN-VARIANTS`, and `MD-SPAWN-SPEEDS`. They are development repair evidence, not protected completion. The interactive Pi process that produced the blocked card remains open with the old imported wrapper; a restart is needed for that process to use the corrected code. Its saved game and transcript were left intact.

## Stage 04 diagnostic UI, host-probe compatibility, and fresh reset — 2026-11-22 local

The latest Stage 04 transcript is `sessions/04/2026-11-23T03-44-51-757Z_01a20681-ae2d-737a-b5c4-dce00744a1c0.jsonl` in the Meteor test workspace. The host diagnostic improved from 48/51 to 49/51 after the Worker changed the meteor scene root. Its two remaining `UNVERIFIED` rows came from the host probe reading `spawn_interval` while the saved game exposed `current_spawn_interval`; the Stage 04 task did not require either internal name.

- Pi Sitter `src/index.ts` now persists a `pi-sitter-project-diagnostic-pending` entry before awaiting the host callback and renders it in muted gray. The completed result occupies that card; a click expands the failure details and the exact Worker prompt. A later result labels the previous prompt accurately when no new continuation was sent. No trigger threshold, retry limit, or protected-verifier authority changed.
- The host-owned candidate suite at `/home/jfin/dev/llm-zone/protected-suites/meteor-dodge-v1` now reads either interval property in `gate-probe.gd`, including the later reset check, and `manifest.json` pins the new probe SHA-256 `f88c481e38c39c41d4abfd493541e150042daaf5abb6f81debd86fc0c574fd67`. No gate ID, requirement, assertion, or stage mapping changed. This external host fixture remains separate from Pi Sitter runtime acceptance.
- The live Stage 04 Pi session and its editor were closed before changing the host suite. The successful game, prior installed extension, cache, and transcripts were archived at `sessions/archives/pre-stage-04-verifiable-rerun-2026-11-23T04-00-57Z/workspace.tar.gz` (SHA-256 `2551ce3804cb2c4bb1349c5ad51ee312ab58aea236ff43bb86742dbdc021c13c`). The five previous Stage 04 transcripts remain in `sessions/04/`.
- Restored `project.godot`, `main.tscn`, `scenes/meteor.tscn`, the two Stage 03 scripts and UIDs, and the shape resources byte-for-byte from the earlier `pre-stage-04-required-repair-rerun-2026-11-23T03-27-49Z/workspace.tar.gz`. Removed `scripts/main.gd`, its UID, generated cache, and prior editor log. No misplaced `res:` directory remains. Godot regenerated its cache successfully. The worker's next `/04` turn has not been started.

| Exact command or check | Outcome |
| --- | --- |
| Source revision and package | `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b`, dirty local `0.1.9`; previous and target versions both `0.1.9` |
| `node --experimental-strip-types --test tests/empty-final.test.mjs` | PASS, 13/13, including pending-before-result, exact prompt equality, final-card disclosure and session replay |
| `npm run check`, `npm test`, `git diff --check` in Pi Sitter | PASS; runtime 147/147 |
| `PI_SITTER_STAGE=04 PI_SITTER_PROJECT_ROOT=<test workspace> GODOT_PATH=/home/jfin/.local/bin/godot npm test` in host suite, before reset | PASS, 51/51 host checks on the saved best-run game; development diagnostic only |
| `./update-pi-sitter.sh` in test workspace | PASS; ran type check and 147 tests, installed packaged `0.1.9`; installed `src/index.ts` SHA-256 `501fcc0757de93467d4600999d87ded89721e6c71c315ac33c9e73683c0aaab8` matches local source |
| `/home/jfin/.local/bin/godot --headless --path . --editor --quit` after reset | PASS, exit 0; rebuilt the editor cache |
| `./start-pi.sh 04 --check` after reset | PASS; Pi Sitter Active, Ponytail Lite, Stage 04 prompt and host diagnostic loaded without starting the Worker |
| Baseline byte comparison and suite digest check | PASS; all nine restored files match the prior archive, the pinned probe digest matches, and the stage has 51 host gates |

The host suite is a candidate diagnostic, not protected final acceptance: the current benchmark launcher still exposes it to the Worker account and has no independent trusted controller review. The next live Worker run and interactive event-to-pixel timing of the muted card remain unqualified.

## Earlier directive implementation checkpoint

**Status:** Automated source checks passed; installed and live Worker behavior remain unqualified. **Source:** `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b` plus pre-existing dirty owner work and this uncommitted implementation. **Package:** `0.1.9`, unchanged. No commit, release, or test-workspace installation was made.

## Implemented

- A Worker directive is assembled at the existing safe `turn_end` boundary from the trigger, exact operation, recent receipt, and bounded task evidence. It starts with a stop command and a distinct grounded read or explicit blocker. Model diagnosis fields remain in intervention/outcome entries for audit; weak loop actions fall back to deterministic advice within the existing budgets, and the rejected suggestion is quoted as not sent to the Worker.
- Preview and `saved:false` receipts are non-progress. A `saved:true`, `dry_run:false`, `updated` scene-save receipt with null/null opaque placeholders is progress; genuine equal non-null before/after values remain no-change. This changes observed trigger events without changing any T1–T5 threshold: the recorded first no-op T4 still fires, while the second recorded T4 does not fire after the now-recognized saved update. T5 still requires five consecutive identical inspections before recovery.
- The host diagnostic continuation uses short prioritized `ID: observed mismatch` lines and marks its snapshot as potentially stale after repairs. It retains one retry, protected gate separation, and the existing advisory authority. The intervention card leads with the command and first action, quotes the delivered text once when expanded, and places diagnosis evidence below it.

## Evidence

The local fixture at `tests/fixtures/stage04-interventions.json` contains all 32 recorded tool call/result pairs from the 92-entry Stage 04 retry, both original T4 records, and bounded diagnostic first lines. The replay produces one T4 after the previewed node creation. It classifies the later saved scene as progress, so the original three-read recovery T4 is no longer emitted. A direct replay of the second recorded T4 through the directive builder rejects the vague model suggestion and names the different saved-script read or a blocker. The fixture is local to developer tests; Pi Sitter runtime has no benchmark-specific paths or behavior.

- `node --experimental-strip-types --test tests/intervention-directive.test.mjs` — PASS, 4/4. Covers recorded preview/saved receipts, before/after distinction, both recorded T4 directives, stale diagnostic labeling, weak actions, and concise failures.
- `node --experimental-strip-types --test tests/intervention-directive.test.mjs tests/adapter.test.mjs tests/empty-final.test.mjs` — PASS, 52/52 before the final null-placeholder narrowing and stale-diagnostic integration case. Adapter tests check exact delivered/card prompt identity, weak-advice fallback, collapsed and expanded layout, unresolved repeated reads, mode/budget/cancellation/replay behavior. Native Pi diagnostic tests check concise retry text and its one-retry limit.
- `node --experimental-strip-types --test tests/adapter.test.mjs` — PASS, 38/38 after the final integration case.
- `node --experimental-strip-types --test tests/native-intervention.test.mjs` — PASS, 1/1. In a real Pi scripted-provider continuation, the directive reaches the next Worker model context exactly once, and further identical reads do not insert another copy.
- `node --experimental-strip-types --test --test-name-pattern='weak inspection advice|rejected supervisor replies' tests/adapter.test.mjs` — PASS, 2/2 after strengthening the UI assertion to reconstruct the expanded quote and compare it byte-for-byte with the delivered directive.
- `npm run check` — PASS.
- `npm test` — PASS, 144/144 after the final source and test changes.
- `npm run test:runner` — PASS, 110/110. The Dope development runner was not invoked to execute a phase.
- `git diff --check` — PASS after final source and documentation edits.

## Evidence gaps and boundaries

No new live Stage 04 run was made. The owner explicitly excluded installation into the test workspace, so model compliance, saved-project repair quality, and host diagnostic outcome after this patch remain unknown. The deterministic replay establishes observation and delivery behavior, not that the Worker will obey the directive. The changed scene-save classification means the original second T4 is not a guaranteed live intervention; the initial host diagnostic continuation now warns against repeating unchanged reads, while T5 retains its existing five-consecutive-read threshold.

This work did not change protected acceptance tests, T1–T5 thresholds, inference budgets, tool authority, or formal verification status. No diagnostic PASS was promoted to VERIFIED.

## Final post-edit checks

Executed with Node `v24.21.0`, npm `11.19.0` on the source revision above, with the dirty worktree preserved:

| Exact command | Result |
| --- | --- |
| `npm run check` | PASS, TypeScript no-emit check |
| `npm test` | PASS, 144/144 runtime tests |
| `npm run test:runner` | PASS, 110/110 developer-runner tests |
| `git diff --check` | PASS |

No test-workspace installation or live Stage 04 run was attempted, in accordance with the owner’s explicit boundary.

## Repair requirement follow-up — 2026-11-22 local

After the later Stage 04 run at `sessions/04/2026-11-23T02-58-29-994Z_01a20657-3bea-7218-9d61-526f6dbe0536.jsonl`, the owner asked for stronger injected repair instructions and deferred a fresh Worker context. The installed prior source caught the repeated inspection, but its fallback reported no grounded alternate read; the Worker then misused `res://` paths with ordinary file tools and ended after promising future reads. Both host diagnostics were `FAIL`, 37/51, with identical failed IDs and no saved source change.

The local source now tells the Worker that it **must carry out the original requested source repair**, save a supported change, and check the saved result before finalizing. It permits an exact blocker report when the original task's stop conditions genuinely apply. The T5 fallback uses an explicit file target from the original task when no earlier path-bearing read exists. T1 failures caused by giving `res://` paths to ordinary `read` or `ls` tools receive the exact project-relative argument instead of another directory-inspection suggestion. The host diagnostic continuation carries the same repair requirement. No new Worker context, trigger, threshold, diagnostic retry, verifier authority, or acceptance criterion was added.

Source baseline: `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b` plus the preserved dirty owner work and this uncommitted follow-up; package version remains `0.1.9`.

| Exact command or check | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/intervention-directive.test.mjs tests/empty-final.test.mjs tests/native-intervention.test.mjs` | PASS, 20/20 before the final wording adjustment |
| `npm run check` | PASS |
| `npm test` | PASS, 146/146 before the final wording adjustment |
| `./update-pi-sitter.sh --check` in the test workspace | PASS after the final repair wording, TypeScript check and 146/146 tests; package validated without installation |
| Read-only replay of the latest 70-entry Stage 04 transcript through the local engine/directive builder | T5 now directs inspection of `res://main.tscn` through Godot or `main.tscn` through a file tool; T1 provides `scripts` for `ls` and `scenes/meteor.tscn` for `read`; all directives require a saved repair or an exact task-defined blocker |

The Stage 04 `start-pi.sh 04` process and its child Pi process were still running at qualification time. The installed extension was left untouched. No fresh live Worker run or model-compliance claim was made. The next installation must occur after that live process ends, followed by a Stage 04 rerun if the owner requests live qualification.

## Owner-authorized installation and clean Stage 04 reset — 2026-11-22 local

The owner closed the prior Pi session and requested installation plus a clean Stage 04 retry starting state. No Stage 04 Worker run was launched in this reset.

- Confirmed no `start-pi.sh 04`, Pi child, or project Godot editor process remained. The game files already matched the earlier Stage 03 structural baseline: `main.tscn` had no `Meteors` or `main.gd`, `scripts/main.gd` was absent, and `meteor.tscn` retained the lowercase Area2D root, `Visual`, `Collision`, and its script. This preserved the known inherited root-name defect for the Worker to inspect and repair.
- Archived the pre-reset game, Godot cache, host test files/results, previous installed Pi Sitter, Stage 04 prompt and sessions under `sessions/archives/pre-stage-04-required-repair-rerun-2026-11-23T03-27-49Z/workspace.tar.gz`. SHA-256: `8fc50b9eb0bf358d875408fbf9e5b61c322d51c3c895233b03fbbf2b2e2aefc7`. Existing Stage 04 JSONL transcripts remain at their original paths. Moved the previous generated cache, test results and editor log into the archive directory before regenerating the editor cache.
- Ran `./update-pi-sitter.sh` in the benchmark workspace: PASS. Its source `npm run check` and `npm test` passed (146/146), and the packed dirty source from HEAD `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b` was installed as package `0.1.9`. Installed `src/index.ts` and `src/intervention-directive.ts` match local source byte-for-byte.
- Ran `/home/jfin/.local/bin/godot --headless --path . --editor --quit`: exit 0. Godot scanned and imported the reset project. It warned about an older nested archived `project.godot`, then completed initialization; this was an editor startup check, not Stage 04 gameplay verification.
- Ran `./start-pi.sh 04 --check`: PASS. It loaded Pi Sitter Active mode, Ponytail Lite, the Stage 04 prompt and host diagnostic. The check did not launch the Worker or run protected acceptance.

The workspace is ready for a new `/04` Worker turn. Whether the model follows the stronger directive and saves a repair remains a live qualification gap.

## Cancelled Stage 04 path failure and prompt reset — 2026-11-22 local

The next live Stage 04 transcript is `sessions/04/2026-11-23T03-29-33-593Z_01a20673-ab98-7425-9b69-1e434f019bd8.jsonl` (90 entries, 31 Worker tool calls). It ended with a tool result after cancellation, without a final Worker report or host diagnostic. Pi Sitter delivered three interventions. The two path-error directives explicitly supplied `ls {"path":"scripts"}` and `read {"path":"scripts/meteor.gd"}`, and the Worker followed those actions. It later used Pi `write` with `path: "res://scripts/main.gd"`; the tool reported success but created a real `res:/scripts/main.gd` under the project. Godot repeatedly rejected attachment of `res://scripts/main.gd` because `scripts/main.gd` did not exist. Pi Sitter's attach-error model advice said to inspect the `res://` path without specifying which path form to use for Pi file tools; the Worker read the misplaced file and retried attachment. Separately, the Worker recreated the existing meteor scene and did not save the newly created `Meteors` node in Main. A path correction is necessary but not evidence that the model will complete Stage 04.

The host benchmark's `prompts/04.md` now places exact path mappings at the top: Pi `read/write/edit/ls/find/grep/bash` use project-relative `scripts/main.gd`, `scripts/meteor.gd`, and `scenes/meteor.tscn`; Godot MCP/script references use `res://...`. It warns that a successful Pi `write` with `res://` creates a separate `res:` directory and requires checking the real script before attachment. The same prompt requires inspection before recreating `meteor.tscn` and saving/read-back of `main.tscn`. Host `AGENTS.md` now names the Pi file tools and the write/attachment example. No task acceptance criterion or Pi Sitter runtime source changed.

The failed game files, misplaced `res:` directory, cache and transcript were preserved in `sessions/archives/pre-stage-04-path-prompt-rerun-2026-11-23T03-36-57Z/failed-workspace.tar.gz` (SHA-256 `cf54ba2315621971b1565d68fd7b9f28ea4f44b0a45560c654ef76d4de67903a`). The earlier pre-run archive preserves the prompt used by the cancelled Worker; the new archive includes the amended prompt. The prior clean game bytes were restored from the pre-run archive; `main.tscn`, `scenes/meteor.tscn`, `meteor.gd`, `player.gd`, and the two shape resources match that archive byte-for-byte. The misplaced `res:` directory is no longer active. `sessions/archives/.gdignore` excludes archived source from Godot editor scanning.

| Exact command or check | Result |
| --- | --- |
| Initial `/home/jfin/.local/bin/godot --headless --path . --editor --quit` after reset | exit 134 after scanning archived files; generated cache preserved as evidence |
| Same Godot editor startup after adding archive `.gdignore` and moving failed cache | exit 0, project scan/import completed, no stderr |
| `./start-pi.sh 04 --check` | PASS; Pi Sitter Active, Ponytail Lite, Stage 04 prompt and host diagnostic loaded |
| Python byte comparison against the pre-run `workspace.tar.gz` | PASS for the restored game files; confirmed no active `res:` directory or `scripts/main.gd` |

The installed Pi Sitter source remains the same dirty `0.1.9` source from HEAD `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b`. No new Worker retry or protected acceptance run was started after the prompt change. Prompt compliance and completion remain unqualified.

## Subsequent owner-authorized Stage 04 test reset — 2026-11-22

The owner subsequently requested a reset of the test workspace for a fresh Stage 04 run. This supersedes the earlier installation boundary for this reset only. The live Worker rerun has not yet occurred; behavior remains unqualified.

- Test workspace: `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01`.
- Preserved the failed Stage 04 JSONL transcripts in `sessions/04/`. Archived the pre-reset game files, Godot cache, test files/results, installed Pi Sitter, and Stage 04 sessions in `sessions/archives/pre-stage-04-directive-rerun-2026-11-23T02-54-49Z/workspace.tar.gz` (SHA-256 `c3813106858c4544a8ab06f0e2c3ca801f3068638cd89dda739b119c59cc60c9`).
- Stopped the still-running Stage 04 Pi process, allowing its launcher to close the editor. Restored the saved Stage 03 game structure shown in the Stage 03 and opening Stage 04 transcripts: removed Stage 04’s `Meteors` node, `main.gd` attachment and script; rebuilt `meteor.tscn` with its Stage 03 root, `Visual`, `Collision`, script, collision layer, and saved shape. The earlier meteor scene bytes and scene UID were unavailable after Stage 04 overwrote it, so this is a structural reconstruction rather than a byte-identical snapshot.
- Ran `./update-pi-sitter.sh` in the test workspace — PASS. Its `npm run check` and `npm test` passed (144/144), and it installed the current dirty source on revision `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b`. Installed `src/index.ts` and `src/intervention-directive.ts` match local source byte-for-byte.
- Ran `./start-pi.sh 04 --check` — PASS; the Stage 04 prompt, Pi Sitter Active mode, Ponytail Lite, and host diagnostic load. Ran `/home/jfin/.local/bin/godot --headless --path . --editor --quit` in the test workspace — exit 0. This checked editor startup and filesystem scan, not Stage 04 gameplay or protected acceptance.
- No Stage 04 Worker run was launched. The saved Stage 03 attempt had ended without a final report, and its meteor scene lacked a default texture; those pre-existing gaps were retained for the Worker’s Stage 04 inspection. No commit, package version change, release, or protected gate claim was made.
