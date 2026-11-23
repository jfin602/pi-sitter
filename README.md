# Pi Sitter

Pi Sitter is an on-demand supervisor extension for the [Pi Coding Agent](https://docs.pi.dev/latest/extensions). It watches a worker's Pi session for repeated failures, ineffective operations, and configured milestones. A trigger starts a bounded diagnosis with Pi's selected model, returns evidence-backed guidance to the worker, then goes quiet. The worker keeps ownership of implementation changes.

Pi Sitter was extracted from an embedded supervisor experiment in `llm-zone`. This repository is the standalone extension. `llm-zone` owns benchmark prompts, fixtures, and results; Pi Sitter has no runtime dependency on them.

## Install

From GitHub:

```bash
pi install git:github.com/jfin602/pi-sitter
```

After the package has been published to npm, install it with `pi install npm:pi-sitter`. The npm package is not published yet.

For development, clone this repository, run `npm install --ignore-scripts --no-package-lock`, then load it for one Pi invocation with the installed Pi CLI's `-e /absolute/path/to/pi-sitter` option. The `pi.extensions` manifest points at `src/index.ts`. Pi loads TypeScript directly; there is no build artifact.

## Use in a coding project

Pi Sitter starts **Off**. Run `/sitter on` to activate supervision, `/sitter shadow` to record findings without steering, or `/sitter off` to stop it. The panel starts closed. `/sitter` toggles it; `/sitter status`, `/sitter gates`, and `/sitter report` inspect its current state. `/sitter verify` runs configured completion verification while the worker is idle. `/sitter recover` queues an available recovery prompt.

In Active mode, Pi Sitter observes tool results and triggers a short diagnosis only after repeated errors, repeated setup without progress, a supplied milestone failure, or repeated no-op receipts. It does not start a supervisor model session when the extension loads. Diagnosis uses the worker's selected Pi model; configure that model through Pi. No LM Studio model, local model path, or benchmark stage is required.

The default task label is `current`. Set `PI_SITTER_STAGE` only if your integration uses named stages. `PI_SITTER_MODE` may be `off`, `shadow`, or `active` at startup. `PI_SITTER_LIMITS` accepts a JSON object with bounded budgets such as `maxInferenceAttempts`, `maxRecoveryAttempts`, `maxCompletionVerifications`, and `timeoutMs`.

## Completion verification

An external, **host-approved** verification runner is optional. Set `PI_SITTER_VERIFY_COMMAND` in the trusted launch environment to a JSON array whose first element is an absolute executable path, for example:

```bash
export PI_SITTER_VERIFY_COMMAND='["/usr/bin/node","/opt/approved-verifiers/check-project.mjs"]'
```

The runner receives `PI_SITTER_STAGE` and `PI_SITTER_PROJECT_ROOT` and emits one JSON `GateReport` on stdout. It runs via `execFile` without a shell, inside Linux `bubblewrap` with the filesystem mounted read-only and network access disabled. `bubblewrap` must be installed for this runner. It may use a private temporary directory. A project file or model response cannot configure the command. A missing runner blocks completion verification; it does not create a passing result. See [verification protocol](docs/verification.md) for the report shape.

Trusted extension authors can instead call `createPiSitter({ verify, loadGates, evidenceBroker, ... })` and supply a verifier and evidence provider directly. This preserves the independent supervisor session and broker integration points from the source project. Verification interfaces are generic; Vitest, Godot, and any other project-specific checks belong in an external runner or adapter.

## Read-only boundary

The supervisor's separate Pi session starts with no built-in tools. It exposes snapshot inspection through an adapter-supplied broker and blocks every other tool call. Direct MCP supervisor tools are disabled until a project adapter is independently qualified. The host-approved verification command runs against a read-only project mount and cannot use network access. The broker rejects path traversal and symlinks, caps input and output, and copies approved project evidence into a disposable snapshot.

These boundaries protect against tool-level writes by the supervisor. A trusted adapter's own implementation and a trusted verifier's reported facts still require review. Pi Sitter does not prevent the worker from editing its own project. The extension itself runs with Pi's normal process permissions, as all Pi extensions do.

## Develop and check

```bash
npm install --ignore-scripts --no-package-lock
npm run check
npm test
npm pack --dry-run
```

Tests use deterministic worker events, a non-Godot project, a real Pi package loader, and a sandboxed verifier. The package contains TypeScript source under `src/`, so the manifest and exports work from npm or Git installs.

## Repository versioning

[Change-driven versioning](docs/VERSIONING.md) ([ADR 0002](docs/decisions/0002-change-driven-versioning.md)) replaces phase-assigned version checkpoints with one patch increment per successfully completed Pi Sitter repository mutation prompt that retains tracked changes. Read-only/no-op work makes no version change; multiple changed files in one prompt still count once. Major/minor releases and npm publication remain explicitly owner-authorized, not automatic.

**Not yet implemented:** The original Dope phase runner, compatibility tests and authored P1–P10 prompts still enforce fixed versions. That stack is **on execution hold** until the versioning migration is qualified; `package.json` remains `0.1.0` during this documentation application. The repository intentionally disables lockfiles with `.npmrc` (`package-lock=false`); do not generate a lockfile as part of version syncing.

## Architecture and developer workflow

The [documentation index](docs/README.md), [current implementation status](BOOT.md) and [owner-approved ADR](docs/decisions/0001-ten-approved-decisions.md) distinguish working 0.1.0 behavior from proposed 1.0 contracts. The existing triggers are intentionally preserved. Structured Vitest suite provenance, full worker MCP tool parity, and expanded requirement review are **not yet qualified**.

The [Dope Codex phase runner](docs/runner.md) is a **developer-only** workflow. It is different from Pi Sitter's runtime approved test runner and is not published as part of the Pi extension. The root uses `.npmrc` to disable lockfiles because the original Dope runner rejects `package-lock.json`. Use Node 24 for runner tests. To check the runner:

```bash
npm run test:runner
```

P1–P10 implementation/closeout prompt files are authored but not executed, and their fixed versions are now superseded. Do not run them before migration/independent authorization, or treat this documentation application as authorization to publish 1.0.
