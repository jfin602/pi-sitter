# Pi Sitter Engineering Workflow

**Adapted from Vault/Dope:** task-anchored bounded context, reviewed architecture, isolated implementation and independent qualification. Dope's IDE/Work and Vault's storage/TUI are **not** Pi Sitter components.

1. **Inspect:** source revision/dirty state, `AGENTS.md`, `BOOT.md`, module owners and only relevant docs/source.
2. **Decide:** agree on behavior and constraints; durable decisions go to `docs/decisions/NNNN-slug.md` with alternatives, consequences and supersession.
3. **Plan:** create `docs/tasks/<phase>/README.md` with precise scope, no-go boundaries, dependencies and verification matrix; optional assessment/implementation plan if complexity warrants.
4. **Owner review:** documentation approval is separate from implementation/runner execution. The 2026-11-23 version policy has been approved, but documentation adoption alone does not activate bump automation or update the existing package version during migration.
5. **Implement:** author bounded implementation prompts, validate first, and obtain separate owner authorization for execution. The authored P1 fixed-version stack is **on hold pending [versioning migration](VERSIONING.md)**; syntax checks alone are not execution approval. While the legacy runner is active it owns Git staging/commits/logs; worker agents must not self-commit within runner tasks.
6. **Verify:** deterministic tests, real Pi integration, protected suite and MCP safety negative cases. Record source SHA, environment, exact command/observations and PASS/FAIL/NOT RUN/BLOCKED/EVIDENCE GAP.
7. **Closeout:** maintain distinct implementation, verification and owner-progression statuses. Once the deterministic [versioning policy](VERSIONING.md) is qualified, each successfully completed repository-mutating prompt advances exactly one next-patch checkpoint, independently of phase; read-only/no-op work does not. Avoid retry double-bumps; reconcile partial failures. Owner authorizes 1.0 publication only after required evidence passes.

Keep executed prompts and failed qualification reports immutable; append repair plans and later evidence instead of rewriting history. Update `BOOT.md` with bounded truth and the next action; don't add transcripts to `AGENTS.md`.

[Developer runner](runner.md) is distinct from [runtime verification runner](contracts/verification-runner.md).
