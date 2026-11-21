# Pi Sitter

Pi Sitter is an on-demand supervisor extension for the [Pi Coding Agent](https://docs.pi.dev/latest/extensions). It watches a worker's Pi session for repeated failures, ineffective operations, and configured milestones. A trigger starts a bounded diagnosis with Pi's selected model, returns evidence-backed guidance to the worker, then goes quiet. The worker keeps ownership of implementation changes.

Pi Sitter was extracted from an embedded supervisor experiment in `llm-zone`. This repository is the standalone extension. `llm-zone` owns benchmark prompts, fixtures, and results; Pi Sitter has no runtime dependency on them.

## Install

From GitHub:

```bash
pi install git:github.com/jfin602/pi-sitter
```

After the package has been published to npm, install it with `pi install npm:pi-sitter`. The npm package is not published yet.

For development, clone this repository, run `npm ci`, then load it for one Pi invocation with the installed Pi CLI's `-e /absolute/path/to/pi-sitter` option. The `pi.extensions` manifest points at `src/index.ts`. Pi loads TypeScript directly; there is no build artifact.

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
npm ci
npm run check
npm test
npm pack --dry-run
```

Tests use deterministic worker events, a non-Godot project, a real Pi package loader, and a sandboxed verifier. The package contains TypeScript source under `src/`, so the manifest and exports work from npm or Git installs.
