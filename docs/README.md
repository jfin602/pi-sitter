# Pi Sitter — Documentation Index

## Current project truth and navigation

- [Agent router](../AGENTS.md) — engineering invariants and bounded context.
- [Boot/current status](../BOOT.md) — source-backed implementation vs future design.
- [Module map](../MODULES.md) — owners and trust boundaries.
- [Roadmap](../ROADMAP.md) — planned independent 1.0 phases.
- [Vision](VISION.md), [principles](PRINCIPLES.md), [architecture](ARCHITECTURE.md).

## Architecture contracts

- [Gate report](contracts/gate-report.md) — trusted, versioned and provenance-bound Vitest-first gate outcomes.
- [Verification runner](contracts/verification-runner.md) — approved commands, scope and isolation.
- [Supervisor tool access](contracts/supervisor-tools.md) — worker MCP discovery and host-enforced read-only filtering.
- [Recovery](contracts/recovery.md) — evidence-backed repair package.
- [Completion](contracts/completion.md) — test vs requirement distinction.
- [Existing v1 verification protocol](verification.md) — currently implemented interface; **not** the complete new contract.

## Development workflow and qualification

- [Workflow](workflow.md), [versioning policy](VERSIONING.md), [Dope runner](runner.md), [stability contract](stability-contract.md).
- [Owner-approved architecture ADR](decisions/0001-ten-approved-decisions.md), [change-driven versioning ADR](decisions/0002-change-driven-versioning.md), [ADR index](decisions/README.md).
- [Task index](tasks/README.md), [P1 plan](tasks/p1/README.md), [P1 qualification ledger](tasks/p1/qualification/README.md).

**Status discipline:** Proposed/approved documentation is not evidence of implemented features. See `BOOT.md` before making capability claims.

## Source-audited P1 implementation planning (documentation applied, code pending)

- [Codebase gap audit A01–A12](tasks/p1/codebase-gap-audit.md) — observed counterexamples, source references, ownership and release blockers.
- [Implementation dependency plan](tasks/p1/implementation-plan.md) — F0-R transition → P1–P6 work, stop rules and manual gates.
- [Source-bound qualification matrix](tasks/p1/qualification/README.md) — all **new** qualification cases still pending; baseline CI evidence is not 1.0.
- [Review #3](https://github.com/jfin602/pi-sitter/issues/3) — accepted documentation proposal. Original ADR Q1–Q10 unchanged; schema v1 verification remains historical/current code, not target vNext.
