# ADR 0002 — Change-driven package versioning

- **Date:** 2026-11-23
- **Status:** Owner approved; documentation applied; implementation and qualification pending
- **Scope:** Pi Sitter repository authoring/version metadata, **not** the on-demand supervisor runtime or its worker's project
- **Supersedes:** Active fixed phase/prompt-to-patch assignments in runner/roadmap/P1 planning; preserves historical artifacts and ADR 0001

## Problem

Pi Sitter now evolves through many independent one-off fixes. Phase-linked patch numbers allow multiple real project changes without a corresponding version change. The existing imported Dope developer runner and authored P1–P10 prompts encode fixed checkpoint versions, so this requires a deliberate compatibility migration, not a documentation-only claim of success.

## Decision

Use **one patch increment per distinct successfully completed prompt that retains changes in this repository**. Read-only, no-op, cancelled/fully reverted work does not increment. Multi-file prompts still count once; partial failures require reconciliation; retries/resumes must be idempotent. Docs, tests, code and configuration all count after implementation. Actual authoritative version, not P-number or phase, determines the next patch. Major/minor releases need explicit owner authorization; npm publishing/tagging is always separate.

The version change must be deterministic, verified and tied to a logical prompt/checkpoint rather than entrusted to a model's memory. Do not fabricate catch-up releases for prior fixes.

## Rejected alternatives

- **Phase-linked increments:** miss independent fixes between phases.
- **Manual model-remembered increments:** prone to drift and duplication.
- **One bump per file/commit/tool call:** double counts a logical prompt.
- **Retrospective catch-up versions:** creates unsupported release history.

## Consequences

1. [Versioning contract](../VERSIONING.md) becomes authoritative for the target behavior.
2. Keep current `.npmrc` no-lockfile invariant. No surprise `package-lock.json`.
3. Preserve historical fixed-version P1–P10 prompt texts, but block their execution until runner, tests and executable prompts are migrated, reviewed and qualified. Manual final closeout interlock, provenance and existing supervisor trigger behavior remain protected.
4. Documentation adoption alone does not alter `package.json`, tags or npm; apply a **single** patch increment only with a later successful implementation transition.
5. `1.0.0` remains independently qualified and owner approved, not a versioning-policy side effect.

**Acceptance:** verified exactly-once increments for successful mutating prompts, no increments for read-only/no-op/failed-without-reconciled-changes, safe resume, no phase assignments or automatic publication.
