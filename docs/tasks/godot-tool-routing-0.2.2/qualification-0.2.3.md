# Godot tool routing 0.2.3 — implementation qualification

**Date:** 2026-11-23 local. **Pi Sitter implementation base revision:** `618618669704c625980cd4d7275603e8468f42ff` on `codex/test-discovery-no-tests`, with pre-existing dirty owner work preserved. **Benchmark host base revision:** `06f43764b76834b7c9a66af57e6c998e6d356df0`; the relevant benchmark launcher and host files were already untracked in that repository. At the implementation checkpoint, no commit, tag, publication, benchmark package installation, game reset, or live Worker retry was made. A later owner-requested local installation is recorded below.

## Evidence and changes

- Read the saved Stage 05 JSONL at the path in the task plan without modifying it. Its 52 lines contain Pi `edit` calls for `res://scripts/main.gd` at zero-based records 29, 33, and 44 (JSON argument lengths 3247, 3247, and 3303); a Godot script read occurs between the second and third edits. Later Worker shell calls occur at records 46 and 50. The final edit has a changed body but the same invalid target.
- The benchmark host now installs a Pi 1.5.2 `tool_call` guard in `pi-config/sitter-host.ts`, implemented in `pi-config/godot-tool-policy.ts`. It verifies the project marker and resolves existing ancestors and symlinks before dispatch. Pi `write` and `edit` can write only approved `test-output/worker/` report files (`.txt`, `.json`, `.log`, `.xml`). Game artifacts, protected tests, ambiguous targets, and outside paths are blocked with a route-specific error. Pi reads and Godot MCP calls remain available. The launcher removes unrestricted Worker `bash`; the existing host diagnostic remains host-owned and unchanged.
- Generic Pi Sitter captures route fields before discarding large edit/write bodies. The Stage 05 failure directive names `godot_scripts_write` with `{"script_path":"res://scripts/main.gd"}` when the task asks for Godot MCP and that write tool is actively exposed; scene failures use exposed scene open/save operations. A later read does not count as saved progress; a changed-body repeat on the same target records an unresolved advisory receipt. A later saved Godot MCP mutation on that target records recovery. T1–T5 rules and budgets were not changed.

## Exact checks and outcomes

All commands ran in the actual Codex implementation environment with Node `v24.21.0`, npm `11.19.0`, `bwrap` at `/usr/bin/bwrap`, and an invocable Codex CLI. Command availability was checked before source edits; no separate Dope Codex child was launched. During implementation, `node --test tests/runner/codex-phase-runner.test.ts tests/verifier.test.mjs` passed 91/91, including disposable Git operations and the verifier namespace test.

| Package checkpoint | Command (cwd `/home/jfin/dev/pi-sitter` unless stated) | Result |
| --- | --- | --- |
| 0.2.2, before bump | `node --test tests/intervention-directive.test.mjs tests/native-intervention.test.mjs`; then `node --test tests/native-intervention.test.mjs` after adding the Stage 05 native case | 10/10 and 2/2 passed |
| 0.2.2, before bump | `npm run check:all` | TypeScript check passed; runtime 160/160, runner 110/110 |
| 0.2.2, before bump | `npm pack --dry-run --json` | Passed; 86 package files, version 0.2.2 |
| 0.2.2, before bump | `git diff --check` | Passed |
| 0.2.3, after final source edits | `node --test tests/intervention-directive.test.mjs tests/native-intervention.test.mjs` | 12/12 passed |
| 0.2.3, after final source edits | `npm run check:all` | TypeScript check passed; runtime 161/161, runner 110/110 |
| 0.2.3, after final source edits | `npm pack --dry-run --json` | Passed; 87 package files, version 0.2.3 |
| 0.2.3, after bump | `git diff --check` | Passed |
| Host, both checkpoints | `PI_SITTER_REPO=/home/jfin/dev/pi-sitter node --experimental-strip-types --test pi-config/godot-tool-policy.test.mjs` (cwd benchmark project) | 2/2 passed, including native Pi scripted provider |
| Host, before bump | `./start-pi.sh 05 --check` (cwd benchmark project) | Stage 05 extension preflight passed |

The host fixture covers `res://`, relative, absolute, traversed, symlinked, missing and malformed paths, protected criteria, approved report writes, Pi reads, and permitted MCP calls. The native Pi fixture observes both a nested and a direct Pi mutation blocked before execution, checks the original script bytes before the MCP write, then observes a successful MCP script write, scene save fixture call, and approved Pi testing-output write. Its scene remains unchanged after the blocked calls. A separate native Pi Sitter fixture replays the long-body `edit` route and confirms delivery of the MCP write directive, an unresolved receipt after the read and changed edit, and a later recovery receipt only after a saved MCP write. The launcher source contains no `bash` in its Worker `--tools` list.

Focused iterations were initially red while the retained operation signature, scripted inference budget, exposed-tool fixture, and nested-call assertion were being corrected. These were fixture or implementation issues found during development; the final checks above passed after correction. The earlier 0.2.2 `check:all` gate was green before the version advance.

The saved benchmark game was not used as a mutation fixture. Its post-implementation SHA-256 values are `a97e9795b1b4c9242e0367d6c34bf6ca25efb65bcdd761d33653992d95731e8a` for `main.tscn` and `4e5d2e25d61e229cc884cee30a9bf6ed3e8ef9975f11954d04845a236c214b31` for `scripts/main.gd`; no pre-implementation hash was captured for a byte comparison.

## Remaining evidence gaps

- The 0.2.3 package was installed after the implementation checkpoint as recorded below. No live Stage 05 Worker retry or live Godot Editor save was run. Native MCP write/save checks used a scripted fixture, not a connected editor.
- Protected acceptance and independent requirement review remain unrun. Host diagnostic preflight proves extension loading, not game correctness or protected PASS.
- The new host files are untracked in the benchmark repository, so that repository's ordinary `git diff --check` does not inspect their content. Node execution and the focused host tests exercised them directly.

**Assessment:** The host policy and generic advisory correction meet the scoped code and fixture requirements of the plan. Live Worker and protected qualification remain open.

## Owner-requested local installation, 2026-11-23

The owner requested installation of the latest extension into the Stage 05 workspace. The source was the dirty local 0.2.3 checkout at `618618669704c625980cd4d7275603e8468f42ff`; this is a local package snapshot, not a tagged or published release. The workspace previously had 0.2.1 installed. No active Pi session was found before installation. Existing package backup directories were left untouched.

| Command (cwd Stage 05 benchmark workspace unless stated) | Result |
| --- | --- |
| `./update-pi-sitter.sh` | Exit 0. Source `npm run check` passed; `npm test` passed 161/161; local package was packed and installed; Pi listed `packages/pi-sitter`. |
| `node -p 'require("./pi-config/packages/pi-sitter/package.json").version'` | `0.2.3`. |
| `diff -qr /home/jfin/dev/pi-sitter/src pi-config/packages/pi-sitter/src` | Exit 0; installed source matches the local checkout. |
| `./start-pi.sh 05 --check` | Exit 0; Stage 05 extension preflight passed. |
| `PI_SITTER_REPO=/home/jfin/dev/pi-sitter node --experimental-strip-types --test pi-config/godot-tool-policy.test.mjs` | Exit 0; 2/2 host-policy and native Pi fixture checks passed. |
| `sha256sum main.tscn scripts/main.gd` | Both hashes match the pre-install values above; saved game files were unchanged. |

The installer registered the package in the workspace's existing Pi configuration. No live Worker, protected acceptance, game reset, Git commit, tag, or publication was performed. This installation check establishes local package loading, not gameplay correctness.

## Owner-requested Stage 05 workspace cleanup, 2026-11-23

The benchmark workspace reset record is at `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/archives/pre-stage-05-clean-2026-11-23T18-12-54Z/reset-ledger.md`. The current game already matched all 25 files in the documented post-Stage-04, pre-Stage-05 snapshot byte for byte, with no extra game files. A current-state archive was saved with SHA-256 `9411c02ca4e66c956bc1004a68bdaabf86779e9ae3a9574f5357f92fe678f175`. Generated Godot and Vitest/Vite caches were moved into that archive directory, preserving earlier Stage 05 JSONL paths. Godot editor import and a two-frame headless smoke run exited 0; `./start-pi.sh 05 --check` exited 0; installed Pi Sitter remained 0.2.3. No live Worker turn or host/protected verification ran during the cleanup.

## Owner-requested footer version, commit, and reinstall, 2026-11-23

The bottom Pi Sitter status label now reads its version from the installed package manifest and shows `Pi Sitter v0.2.3 active | sleeping | 0 triggers`. The package version stayed 0.2.3. Commit `72a66c468def6311720ceca2fda7027cac0b94d7` contains only `src/view.ts` and its updated adapter assertions in `tests/adapter.test.mjs`; earlier uncommitted implementation and documentation work was preserved. The subsequent local workspace installation packs the full working tree, so its 0.2.3 manifest and earlier uncommitted source changes remain part of that installed snapshot; the Git commit alone is not a clean release of 0.2.3.

| Command | Result |
| --- | --- |
| `npm run check:all` (source root) | Exit 0; TypeScript check, 161/161 runtime tests, and 110/110 runner tests passed. |
| `npm pack --dry-run --json` (source root) | Exit 0; package version 0.2.3, 87 files. |
| `git diff --check` and `git diff --cached --check` (source root) | Exit 0; no whitespace errors. |
| `git commit -m "Show Pi Sitter package version in footer status"` (source root) | Created `72a66c468def6311720ceca2fda7027cac0b94d7`, two scoped files. |
| `./update-pi-sitter.sh` (benchmark workspace) | Exit 0; source check and 161/161 runtime tests passed; package installed and listed by Pi. Installer output saved in `sessions/archives/pre-stage-05-clean-2026-11-23T18-12-54Z/footer-version-install.log`. |
| `node --experimental-strip-types --input-type=module -e 'import { PiSitterView } from "./pi-config/packages/pi-sitter/src/view.ts"; console.log(new PiSitterView().status("active", 0))'` (benchmark workspace) | `Pi Sitter v0.2.3 active | sleeping | 0 triggers`. |
| `diff -qr /home/jfin/dev/pi-sitter/src pi-config/packages/pi-sitter/src` and `./start-pi.sh 05 --check` (benchmark workspace) | Installed source matches checkout; Stage 05 extension preflight passed. |
| `sha256sum main.tscn scripts/main.gd` (benchmark workspace) | Both hashes still match the pre-install values above. |

No live Worker run or protected acceptance was performed. The footer was checked in the adapter harness and directly against the installed renderer; no interactive terminal screenshot was captured.
