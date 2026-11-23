# Pi Sitter — Agent Router

This is a **short task-navigation and engineering policy**, not an execution transcript. Read only files relevant to the active task; do not load the whole documentation tree.

1. Start with [BOOT.md](BOOT.md) (current observed truth) and [MODULES.md](MODULES.md) (owners).
2. Read [docs/README.md](docs/README.md) for project contracts, then only the task-related docs in [docs/contracts/](docs/contracts/). See [docs/VERSIONING.md](docs/VERSIONING.md) for repository versioning.
3. Consult [ROADMAP.md](ROADMAP.md), [docs/workflow.md](docs/workflow.md), [docs/runner.md](docs/runner.md), and the specific [docs/tasks/](docs/tasks/) record when implementing.
4. Durable owner-approved decisions are in [docs/decisions/](docs/decisions/); do not treat proposals as applied code.
5. Existing runtime verification protocol: [docs/verification.md](docs/verification.md). New design requirements: [docs/contracts/gate-report.md](docs/contracts/gate-report.md).

## Engineering invariants

- Pi Sitter is a **standalone Pi Coding Agent extension**, independent of `llm-zone`, Godot, Meteor Dodge, and any fixed benchmark. `llm-zone` consumes *released* Pi Sitter versions, never the reverse.
- **Preserve all existing supervisor triggers and thresholds exactly as implemented.** The ten approved decisions change test-directed focus, not trigger behavior.
- Acceptance tests are owned/protected by the external test controller. The worker may author development tests; Pi Sitter must never author/edit acceptance criteria or test suites.
- Pi Sitter is advisory only. Worker implements source repairs. Test gate status comes from trusted structured runner evidence; independent requirement review is a separate axis.
- Worker-equivalent read-only MCP access is an **approved future contract**, not a claim of current implementation. Deny unvetted/mutating operations at the host/tool layer, never rely on prompts for enforcement. Do not enable direct MCP tools before qualifying the adapter.
- Verification is permitted only through a host-approved isolated runner, with no model-selected shell commands. A read-only root mount does not imply least-privilege confidentiality.
- Preserve provenance: no PASS without saved source identity, approved suite identity and actual test evidence. Missing, skipped, stale, or malformed evidence must fail closed.
- Preserve quiet on-demand inference. Do not start a second model continuously, or expand a gate-directed investigation into unrelated refactoring.
- **Dope Codex phase runner is developer tooling**, not Pi Sitter's runtime verifier. Its existing fixed-version/checkpoint behavior is legacy and must be migrated before running version-bound stacks. While it remains active, it owns commits; worker agents must not self-commit/move HEAD. Read [docs/runner.md](docs/runner.md).
- **Owner-approved versioning target (2026-11-23):** once implemented and qualified, each distinct successfully completed Pi Sitter repository mutation prompt that retains tracked changes increments the patch version **exactly once**, independent of phase, files edited, or prompt number. Read-only/no-op/fully reverted prompts do not increment. See [docs/VERSIONING.md](docs/VERSIONING.md) and [ADR 0002](docs/decisions/0002-change-driven-versioning.md). This documentation adoption does not activate the automation.
- Record exact commands, revision, outcomes and evidence gaps in the task-local qualification ledger. Never treat a commit, generated documentation, or model assertion as a qualified release.
- No source changes, prompt execution, release tags or npm publication merely because a plan exists. Preserve dirty owner work and historical evidence. The owner authorizes execution/closeout separately.

**Current truth (at documentation update):** the checked-in manifest is `0.1.0`; the approved change-driven versioning mechanism is **not implemented or qualified**. Standalone Pi Sitter has basic verification and a restricted supervisor broker; stronger Vitest/MCP contracts remain approved but not implemented or qualified.
