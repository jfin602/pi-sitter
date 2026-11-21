# Pi Sitter — Current Implementation and Handoff

**As of:** 2026-11-21. **Architecture:** 10/10 owner decisions approved in [GitHub issue #1](https://github.com/jfin602/pi-sitter/issues/1). **Documentation application:** this foundation follows approved [review #2](https://github.com/jfin602/pi-sitter/issues/2). **Release:** `0.1.0` source, not 1.0 qualified or published on the basis of this documentation.

## Observed on source baseline before this doc application

- Standalone `pi-sitter` Pi extension manifest points to `src/index.ts`; `src/` implements existing worker triggers, supervisor lifecycle, command/status UI, gate reports, completion and a separate supervisor session.
- `src/gates.ts`: `GateReport` schema v1; `PASS/FAIL/UNVERIFIED` gate results. `src/completion.ts`: `VERIFIED/RECOVERY_REQUIRED/UNVERIFIED/BLOCKED` decisions.
- `src/verifier.ts`: host-set absolute command, `bubblewrap`, JSON output, preliminary shape validation; no native Vitest provenance adapter yet. Its read-only whole-host bind is not confidentiality isolation.
- `src/broker.ts`: bounded evidence snapshot and provider-defined read inspection.
- `src/supervisor-session.ts`: separate Pi session, `pi_sitter_inspect` only. **Direct worker-equivalent MCP parity is disabled**, pending qualified host-enforced filtering.
- Existing `tests/*.test.mjs` cover various deterministic loader/broker/safety/completion cases. These are source evidence of tests, **not proof they pass on the current checkout**.

## Approved design still requiring implementation

- Protected suites and structured Vitest gate identity, coverage, source/suite freshness checks; tests determine gates, not model interpretation.
- Milestone/final test checkpoints with repair reruns; existing non-test triggers unchanged.
- Automatic discovery of worker MCP research abilities with per-operation host-enforced read-only filtering.
- Narrowly scoped sandboxed verifier, detailed evidence-backed recovery and independent requirement-level review.
- Multi-project and real Pi/MCP independent qualification before 1.0.

## Next authorized scope

This `/docs-apply` authorizes **documentation + development runner import + CI/lockfile policy only**. It does not authorize the subsequent P1 implementation stack or 1.0 publication.

Next: review source-gapped architecture contracts and author the P1 implementation prompt stack under `docs/tasks/p1/` in a separate owner-reviewed process. No P1 prompts have been executed.

Dope Codex phase runner and test port are **separate developer tools**, never a runtime Pi extension component. See [runner guide](docs/runner.md). Any CI output, native Pi/MCP observations and manual closeout must be recorded separately; do not infer GREEN from commits.
