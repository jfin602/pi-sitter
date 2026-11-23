# Verification readiness before Worker execution

**Superseded startup behavior (2026-11-22):** The owner removed `/sitter setup` and the new-session readiness announcement. A discovered project test command remains informational. The embedding host may supply a diagnostic callback that Pi Sitter runs at completion for bounded repair guidance; only the approved verifier can authorize protected gates. The prior design and evidence below remain as history.

**Status:** Source readiness UI and host plan selection implemented on 2026-11-22. Startup messaging now reports test-command discovery separately from final validation. Benchmark host integration and protected native qualification remain open. Package version remains `0.1.9`; no release action is implied.

## Observed gap

The original gap was a muted startup entry followed by a visible UNAVAILABLE card only at `agent_before_settle`. The source now displays a visible readiness card before the first Worker call, discovers a bounded `package.json` test script and recognizable tool, and offers `/sitter setup` plus host-only approved plan selection. In the Meteor benchmark, `start-pi.sh` still loads the default extension and supplies neither controller callbacks nor an approved verifier resolver. Its `--check` confirms that Pi Sitter loads, but does not check protected verification readiness. The external 84-check suite exists; the Worker can still access it, so it is not yet protected.

## Desired behavior

1. Before the first Worker model call, Pi Sitter displays a **visible, actionable** test-command card: command found, no command found, uncertain discovery, host plan ready, or blocked configuration. A found command is informational rather than a startup warning. `/sitter setup` also explains final validation readiness separately. A session replay does not duplicate the card or present a historical ready state as current.
2. Discovery reports the package manager, the bounded literal `scripts.test` value, and a recognized tool such as Vitest when identifiable without running project code. It remains informational. An unknown script is labeled unknown rather than guessed. Worker-authored tests, scripts and result files cannot become protected acceptance evidence by discovery or by a Worker message.
3. An embedding host can supply a **host-owned approved plan registry**. A user may select an existing plan ID through `/sitter use <plan-id>` only if the host exposes a trusted selection callback. The command accepts no executable path, shell string, flags or test-file path. It revalidates the selected plan, controller inventory, suite digest, source-snapshot facility, runner isolation and requirement-review capability at session start and before every run. Without that host callback, `/sitter use` explains that setup belongs in the host launcher; it does not write a worker-editable config file.
4. A host can mark protected verification **required** for a run. The benchmark launcher must call the same readiness check during `--check` and before starting Pi; missing or invalid dependencies stop that launch with a specific remedy. Ordinary standalone Pi Sitter remains advisory: no-tests projects and users without a controller receive an early warning, retain existing supervisor triggers, and finish UNVERIFIED rather than being blocked from unrelated work.
5. When ready, completion still uses the existing approved isolated runner and schema 2 provenance checks, followed by independent requirement review. The completion boundary runs the final gate exactly as its current cadence specifies. Missing, stale or malformed evidence remains BLOCKED or UNVERIFIED, never PASS. An empty-final continuation must not duplicate or skip that run.

## Implementation slices

### A. Readiness model and UI

- Add a small `VerificationReadiness` result that distinguishes **discovered candidate**, **approved plan selected**, **controller inventory valid**, **runner available**, **source/suite identity attestable**, and **requirement review available**. Keep discovery separate from approval.
- Evaluate it on `session_start`, after a trusted host plan change, and before a new user task. Show a prominent informational card for a found test command; warn when command discovery fails or configuration is blocked. Preserve the terminal unavailable result when no approved verifier ran, so discovery cannot look like a passing result.
- Make replay cards historical; recheck live host dependencies and show a fresh warning only if readiness changed or a new session begins. Keep a bounded session-local signature to avoid repeated warnings.
- Add `/sitter setup` as a read-only explanation of current readiness and missing host pieces. Extend `/sitter status` with a short readiness summary. Show `no-tests` distinctly from “tests discovered, no protected verifier.”

### B. Safe host configuration

- Define a host-owned plan-ID selection interface next to `PiSitterDependencies`; use the existing `loadControllerContext` and `resolveApprovedVerifier` contracts. The default package extension cannot manufacture either authority from `package.json`, environment strings, session data or prompts.
- If a host supports plan selection, `/sitter use <plan-id>` asks that host to select from its approved registry and displays the resulting readiness. Persist only the plan ID in host-controlled state; recheck the plan and identities at each start/run. Reject unknown IDs, stale suites, source mismatch and malformed settings before execution.
- Document a minimal host configuration example and clear errors for a missing controller, approved suite, isolated runner or review callback. Do not add a generic user-configured shell command.

### C. Benchmark host integration

- Put the Meteor suite and controller outside the Worker's readable/writable view. The host captures an immutable source snapshot including Godot import data, attests the protected suite and dependencies, and supplies the complete stage gate/test inventory and original requirement IDs.
- Connect an approved Vitest/Godot verifier plan to Pi Sitter through a trusted host adapter. The selected stage includes all earlier required gates. Supply current source inspection and independent requirement findings; a green Vitest run alone remains UNVERIFIED.
- Make the benchmark launcher's `--check` and normal start fail early when this required configuration is absent. Only after that preflight passes should the launcher start the Worker. Keep Pi Sitter's standalone package free of Meteor-specific paths or assumptions.

## Qualification

- Unit tests: safe `package.json` discovery (including malformed/oversized/symlink cases), tool classification, missing/invalid host pieces, approved plan selection and rejection of arbitrary commands.
- Native Pi event tests: startup warning appears **before** the Worker turn; `/sitter setup` reports the same state; replay does not duplicate it; no-tests mode stays advisory; a configured plan reaches `agent_before_settle` once after a normal or one-time empty-final continuation.
- Host fixture: `--check` fails before launching Pi when required protection is missing; with isolation and an approved plan, a failing test yields RECOVERY_REQUIRED, a passing suite plus independent review can yield VERIFIED, and tampered suite/source identities fail closed. Verify that the Worker cannot read or modify the host suite or controller.
- Run `npm run check`, `npm test`, and a native Pi benchmark preflight and completion run. Record exact commands, source revision, results and native/host gaps in a task-local qualification ledger. Do not change supervisor triggers or thresholds, package version, acceptance tests, or historical sessions as part of this plan.

## Completion criterion

The fix is complete only when a fresh Meteor benchmark launch either stops at preflight with a clear setup error or starts with an attested approved plan, and a successful Worker final response produces a current protected gate report plus independent requirement findings. A discovered `npm test` command alone must never make readiness green.

## Current implementation evidence

Source slices A and B are implemented: early card, replay handling, `/sitter setup`, host-only `/sitter use <plan-id>`, discovery labels, and preflight rechecks before verifier execution. The default extension has no host plan authority. The native Pi fixture observes the warning before its first Worker turn; source type checking, 131 tests and package dry run pass. See [qualification](qualification.md). Slice C remains open and is required before the benchmark can claim protected final validation.
