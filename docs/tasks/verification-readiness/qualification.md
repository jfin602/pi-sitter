# Verification readiness qualification — 2026-11-22

**Pre-task revision:** `3e12415eebe89c2bca591fe0e44966a1e5d11845` on `codex/test-discovery-no-tests`. Existing uncommitted empty-final, intervention disclosure, verifier runtime-mount and benchmark-suite work was preserved and included in the checked tree. Package version: `0.1.9`.

## Commands and results

- `npm run check`: PASS, TypeScript no-emit check.
- `node --experimental-strip-types --test tests/verification-readiness.test.mjs tests/test-discovery.test.mjs tests/adapter.test.mjs tests/empty-final.test.mjs`: PASS, 48/48. Includes native Pi startup warning before first Worker turn and existing `turn_end`/`agent_before_settle` continuation behavior.
- `npm test`: PASS, 131/131. An earlier run was 124/126 because tests still expected the former discovery object and first notification ordering; those expectations were updated to the new behavior before the passing run.
- `git diff --check`: PASS.
- `npm pack --dry-run --json`: PASS, 72 packaged files, including `src/verification-readiness.ts`.

## Boundaries and remaining work

Discovery still never executes or authorizes the project test script. `/sitter use` accepts only an identifier and needs a trusted host selection callback. A READY card also requires a host preflight attestation; the default standalone package reports missing authority. The Meteor benchmark launcher still lacks an isolated Worker, controller inventory, approved suite resolver, immutable source snapshot and independent requirement review. Native Pi was tested with a scripted provider, not the live benchmark model or an interactive terminal. The benchmark's protected final outcome remains unavailable until slice C is implemented and qualified.

## Test-command startup messaging update — 2026-11-22

At source revision `5b521a6` plus the uncommitted changes in this section, the startup card and `/sitter setup` report a discovered test command as informational, without a warning notification. Missing, uncertain or blocked setup still warns. Completion still records an unavailable final result when no approved verifier exists; the source does not execute a discovered command or infer a pass. Replay accepts both the old and new terminal record text without duplicating the record.

- `npm run check`: PASS.
- `npm test`: PASS, 131/131, including native Pi `turn_end` and `agent_before_settle` empty-response tests.
- `git diff --check`: PASS.
- Live model and interactive Pi display: NOT RUN for this messaging update. The scripted native Pi fixture confirms the persisted startup discovery record before the first Worker turn, but does not render the actual interactive terminal.
- `./update-pi-sitter.sh` in the current Meteor retry workspace: PASS; packaged local `0.1.9` source installed, source tree matches the working tree. This command repeated `npm run check` and `npm test` (131/131).
- `./start-pi.sh 01 --check` in that workspace: PASS; extension preflight and `/sitter setup` availability confirmed. This does not run the live model or certify protected acceptance.

## Quiet startup and host diagnostic guidance — 2026-11-22

Source revision `5b521a6` plus uncommitted changes. The owner removed `/sitter setup` and the new-session startup announcement. The extension now accepts a host diagnostic callback at `agent_before_settle`, saves its advisory result, offers one persisted implementation-repair continuation on failure, and reruns the diagnostic after that continuation. Repeated failure, abort and provider error do not start additional continuations. A configured approved verifier takes precedence. Host diagnostic PASS never enters the protected gate report or produces VERIFIED.

- `npm run check`: PASS.
- `npm test`: PASS, 134/134. Native Pi event tests cover the diagnostic failure, repair continuation, rerun, repeated failure, abort/error, and approved verifier precedence.
- `git diff --check`: PASS.
- `./update-pi-sitter.sh` in the Meteor retry workspace: PASS; repeats `npm run check` and `npm test` (134/134), then installs the working-tree source package.
- `./start-pi.sh 01 --check` in the Meteor retry workspace: PASS; the host wrapper, Pi Sitter, Ponytail, `/host-test`, and `/01` loaded without sending a Worker prompt.
- Live Gemma completion using this installed wrapper: NOT RUN. The native Pi event tests use a scripted provider, and the launcher check does not run the host suite or model. The benchmark diagnostic is not protected acceptance because the Worker still has access to the host suite.
