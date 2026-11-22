# Pi Sitter Task Index

- [P1 — Test-directed supervision for 1.0](p1/README.md): **PLANNED ONLY**. No P1 implementation prompts authored/executed or evidence qualified.
- [P1 qualification ledger](p1/qualification/README.md): placeholder matrix for source-bound results.

Source migration audit: [docs/migration.md](../migration.md). Development runner: [docs/runner.md](../runner.md).

Prompt stacks (once separately authored) live in `docs/tasks/<folder>/P1-*.txt` through a final manual prompt. Executed prompts and evidence are historical artifacts, not free-edit plans; corrections are appended. The runner must not be used on unapproved stacks.

## Audit integration (documented, not implemented)

- [A01–A12 codebase audit](p1/codebase-gap-audit.md) and [source-anchored implementation plan](p1/implementation-plan.md) are the required basis for P1 prompt authoring.
- F0-R **must precede P1**: transitional runner-compatibility tests and golden existing-trigger behavior. New wire schema and v1 ingress still require targeted owner review.
- [Qualification ledger](p1/qualification/README.md) differentiates existing baseline tests from unrun 1.0 acceptance cases. No phase prompts authored/executed by documentation application.
