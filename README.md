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

At session start, a muted transcript entry shows the installed Pi Sitter version, mode, a detected project test command when one is recognizable, and whether protected verification is configured. Discovery reads familiar project markers such as `package.json` test scripts, pytest configuration, `Cargo.toml`, and `go.mod`; it does not execute a command. A detected command is a **candidate**, not an approved acceptance gate. If no command is found in those markers and no trusted verifier is configured, Pi Sitter announces **no-tests mode**. Normal supervision continues, `/sitter verify` explains why verification is unavailable without consuming an attempt, and completion cannot be marked `VERIFIED` from that mode. Unreadable or unsupported setup is reported as undetermined rather than absent.

In Active mode, Pi Sitter observes tool results and triggers a short diagnosis only after repeated errors, repeated setup without progress, a supplied milestone failure, or repeated no-op receipts. It does not start a supervisor model session when the extension loads. Diagnosis uses the worker's selected Pi model; configure that model through Pi. No LM Studio model, local model path, or benchmark stage is required.

When a trigger starts an actual diagnosis, Pi Sitter writes a model-excluded `pi-sitter-intervention` start entry before awaiting the supervisor. Its muted transcript card stays in place as a matching terminal event updates it to guidance, failure, or cancellation. The existing Pi working indicator names Pi Sitter during the attempt. These lifecycle events carry a stable ID and are replayed from the session branch; ordinary observed tool calls create no intervention card.

The default task label is `current`. Set `PI_SITTER_STAGE` only if your integration uses named stages. `PI_SITTER_MODE` may be `off`, `shadow`, or `active` at startup. `PI_SITTER_LIMITS` accepts a JSON object with bounded budgets such as `maxInferenceAttempts`, `maxRecoveryAttempts`, `maxCompletionVerifications`, and `timeoutMs`.

## Completion verification

An external, **host-approved** verification runner is optional. Set `PI_SITTER_VERIFY_COMMAND` in the trusted launch environment to a JSON string plan ID. The embedding host must resolve that ID to an approved executable, arguments, protected suite, source snapshot, and allowed runtime mounts:

```bash
export PI_SITTER_VERIFY_COMMAND='"approved-project-check"'
```

The runner emits one structured report on stdout and runs without a shell inside Linux `bubblewrap` against private read-only source and protected-suite copies. Network access is disabled and scratch is disposable. A project file or model response cannot configure the plan. Missing resolver, unsupported sandbox or malformed report blocks verification. See the [verification runner contract](docs/contracts/verification-runner.md) and [gate report contract](docs/contracts/gate-report.md).

Trusted embedding hosts can call `createPiSitter({ verify, loadControllerContext, evidenceBroker, reviewRequirements, ... })` to supply controller-owned task/suite identity, a verifier and an independent requirement reviewer. Passing protected tests alone stays UNVERIFIED until every authored requirement has current source evidence. The host enforces source/suite integrity and isolation; Pi Sitter's advisory decision is not formal task scoring.

## Read-only boundary

The supervisor's separate Pi session starts with no built-in tools. It exposes snapshot inspection through an adapter-supplied broker. A trusted embedding host may also expose specifically vetted MCP read operations through a host dispatcher; ordinary standalone installs have no such adapter. Server-authored `readOnlyHint` is not sufficient permission. The broker rejects path traversal and symlinks, caps input and output, and copies approved project evidence into a disposable snapshot.

These boundaries protect against tool-level writes by the supervisor. A trusted adapter's own implementation and a trusted verifier's reported facts still require review. Pi Sitter does not prevent the worker from editing its own project. The extension itself runs with Pi's normal process permissions, as all Pi extensions do.

## Develop and check

```bash
npm install --ignore-scripts --no-package-lock
npm run check
npm test
npm pack --dry-run
```

Tests use deterministic worker events, TypeScript and Python fixtures, tarball installs into unrelated temporary projects, the Pi package loader, and a sandboxed verifier. The package contains TypeScript source under `src/`. Headless reporter/model responses are simulated; native Pi/MCP qualification and owner review remain manual. See the [P9 evidence and P10 handoff](docs/tasks/p1/qualification/p9-headless.md).

## Architecture and developer workflow

The [documentation index](docs/README.md), [current implementation status](BOOT.md) and [owner-approved ADR](docs/decisions/0001-ten-approved-decisions.md) distinguish automated source behavior from unqualified 1.0 release requirements. The existing triggers are intentionally preserved. Structured Vitest provenance and requirement review have automated coverage; general worker MCP parity and live model behavior remain unqualified.

The [Dope Codex phase runner](docs/runner.md) is a **developer-only** workflow. It is different from Pi Sitter's runtime approved test runner and is not published as part of the Pi extension. The root uses `.npmrc` to disable lockfiles because the original Dope runner rejects `package-lock.json`. Use Node 24 for runner tests. To check the runner:

```bash
npm run test:runner
```

The phase runner owns implementation commits and version checkpoints. P10 remains a browser-gated manual closeout; no headless result authorizes a 1.0 tag or publication.
