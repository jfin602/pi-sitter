# Pi Sitter Engineering Workflow

**Adapted from Vault/Dope:** task-anchored bounded context, reviewed architecture, isolated implementation and independent qualification. Dope's IDE/Work and Vault's storage/TUI are **not** Pi Sitter components.

1. **Inspect:** source revision/dirty state, `AGENTS.md`, `BOOT.md`, module owners and only relevant docs/source.
2. **Decide:** agree on behavior and constraints; durable decisions go to `docs/decisions/NNNN-slug.md` with alternatives, consequences and supersession.
3. **Plan:** create `docs/tasks/<phase>/README.md` with precise scope, no-go boundaries, dependencies and verification matrix; optional assessment/implementation plan if complexity warrants.
4. **Owner review:** documentation approval is separate from runner execution; no implicit source modifications or version advancement.
5. **Implement:** author bounded `P1-*.txt` etc with runner grammar and the [execution environment and checkpoint preflight](runner.md#execution-environment-and-checkpoint-preflight). Record the previous and target versions, required automated checks, and the post-pass version bump in each prompt. Verify the same Codex child context can run those checks before implementation. Validate grammar first; owner independently authorizes `npm run codex:phase -- <folder>`. Runner owns Git staging/versioned commits and logs. Worker must not self-commit within runner tasks.
6. **Verify:** deterministic tests, real Pi integration, protected suite and MCP safety negative cases. Record source SHA, environment, exact command/observations and PASS/FAIL/NOT RUN/BLOCKED/EVIDENCE GAP.
7. **Closeout:** maintain distinct implementation, verification and owner-progression statuses. Record manual qualification separately; owner authorizes 1.0 publication only after required evidence passes.

Keep executed prompts and failed qualification reports immutable; append repair plans and later evidence instead of rewriting history. Update `BOOT.md` with bounded truth and the next action; don't add transcripts to `AGENTS.md`.

[Developer runner](runner.md) is distinct from [runtime verification runner](contracts/verification-runner.md).
