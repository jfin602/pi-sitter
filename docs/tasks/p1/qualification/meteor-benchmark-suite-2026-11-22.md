# Meteor benchmark suite qualification ledger — 2026-11-22

**Pi Sitter revision:** `3e12415eebe89c2bca591fe0e44966a1e5d11845` plus uncommitted working-tree changes. Package version remains `0.1.9`; no commit, tag, publish or benchmark acceptance-test edit was made.

**External suite:** `/home/jfin/dev/llm-zone/protected-suites/meteor-dodge-v1`. It derives 84 checks from the seven historical Meteor gate manifests and reuses their Godot probe byte-for-byte. The new manifest records stage, gate ID, requirement and probe fact; current prompts remain the benchmark source of truth. Manifest SHA-256: `f94c22f0879ee3070497017297d0c2db4537b4227340094c3f66ab660b67bc56`. Probe SHA-256: `ae54c6d2f35184ea182bc65d9dc61dcf09a3500314ff9120e8d9c1e3a884aa21`.

## Commands and observed outcomes

- `npm install --ignore-scripts` in the external suite: succeeded. Removed generated `.bin` symlinks so the Pi Sitter verifier's suite-tree link rule is met; the suite package script calls Vitest's entry file directly.
- `PI_SITTER_STAGE=01 PI_SITTER_PROJECT_ROOT=/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01 GODOT_PATH=/home/jfin/.local/opt/godot/4.7.2/godot npm test` in the suite: 9/9 pass, exit 0.
- Same command with `PI_SITTER_STAGE=02`: 24/24 pass, exit 0.
- Pi Sitter `approvedVerifier` with a disposable read-only source snapshot, the external suite, explicit Godot binary and runtime library mounts: Stage 01 9/9 pass, structured `vitest-json`, exit 0. The snapshot required the project's `.godot` import cache; without it the background texture check failed 8/9. This is a diagnostic run with placeholder task/source/suite identity values, not an attested protected benchmark run.
- Pi Sitter `approvedVerifier` on a saved historical `Q4_0-twin` project at Stage 07: 82/84 pass and 2 fail, exit 1. `adaptVitestReport` and `normalizeGateReport` attributed failures to `MD-HUD-GAMEOVER-DISPLAY` and `MD-RUNTIME-SMOKE`; `decideCompletion` returned `RECOVERY_REQUIRED`. Diagnostic run used placeholder identities.
- `node --experimental-strip-types --test tests/verifier.test.mjs`: 7/7 pass, including host-approved runtime binary mount and rejection of traversal/source overlap.
- Final `npm run check`: pass. Final `npm test`: 126/126 pass, exit 0.

## Open qualification gaps

The worker runs as the same host user and can read or edit this suite despite its location outside the project. The benchmark host must place the worker in a restricted filesystem view and keep the suite and verifier controller outside it. The controller must capture and attest the saved source snapshot, including a valid Godot import cache, and hash the suite and dependencies. It must provide Pi Sitter with the current task, full expected gate/test inventory, final checkpoint, approved verifier plan and independent requirement review through current source inspection receipts. Until then startup and completion must report protected verification unavailable; a discovered `npm test` command remains informational.

The 84 gates mostly match the revised seven prompts, but the full prompt-to-gate mapping and requirement coverage need owner review. Stages 03–07 have not passed on a finished project under the current suite. Native Pi with the benchmark model and actual host controller has not been run.

## Stage 01 retry diagnosis and host-test handoff

The latest session, `sessions/01/2026-11-22T22-01-17-009Z_01a20547-1fd0-7368-8fd4-36d9f28168e5.jsonl`, used the older prompt that required the Worker to create Vitest tests and run `npm test`. Its new `test/godot/stage_01.test.ts` called `runGodot({ scene: 'res://main.tscn' })`, but the preinstalled helper accepts a string path to a `test/godot/*.gd` script. The local `npm test` failed at this API check before Godot ran. The Worker then made repeated no-op edits to `stage_01.gd`; Pi Sitter emitted a T1 advisory. The final assistant message had `stopReason: "error"`, so there was no successful completion boundary or Pi Sitter completion record. The extension's one-time empty-`stop` continuation correctly did not apply to this provider error.

After the Pi process exited, I changed the seven saved benchmark prompts and benchmark `AGENTS.md` to make the Worker implement game code, perform bounded Godot checks, and hand off to the host for final tests. The next run will receive those instructions; they did not alter the already-started session. I preserved the failed Worker test files and JSON report under `sessions/01/failed-attempt-files/2026-11-22-worker-test-mismatch/` with SHA-256 manifest, then removed them from the active `test/` tree. The preinstalled helper remains.

Direct host diagnostic command from `/home/jfin/dev/llm-zone/protected-suites/meteor-dodge-v1`:

`PI_SITTER_STAGE=01 PI_SITTER_PROJECT_ROOT=/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01 GODOT_PATH=/home/jfin/.local/opt/godot/4.7.2/godot npm test`

Result: exit 0, 9/9 Stage 01 tests passed. An initial `npm test` invocation without those required host variables failed configuration before collecting tests; it was rerun with the required variables. Installed and source `src/index.ts` both hash to `9443034ca81d8008b1ca97aff27584366552e30e4b570c7e95f3470d641dcf3c`. This direct suite run is diagnostic, not protected final validation. The current launcher still has no trusted controller, isolated Worker, approved verifier ingress, or independent requirement review, so it cannot claim an automatic protected supervisor result.
