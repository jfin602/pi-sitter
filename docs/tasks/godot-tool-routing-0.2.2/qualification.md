# Godot tool routing 0.2.2 qualification ledger

## Planning and version checkpoint — 2026-11-23

Source basis: `618618669704c625980cd4d7275603e8468f42ff`, clean before this task. The Stage 05 JSONL and saved project were read only. The owner requested a plan, implementation prompt, and immediate 0.2.2 version increment. No host guard or Pi Sitter runtime fix has been implemented.

Before advancing the manifest from 0.2.1, `npm run check:all` exited 0 in this workspace: TypeScript check, existing runtime suite, and 110/110 developer runner tests passed. These baseline checks establish that the preexisting package was green; they do not qualify the proposed fix. The 0.2.2 manifest and compatibility assertion were then updated. The same check passed again at 0.2.2; its runtime and developer runner suites exited 0, with 110/110 runner tests passing.

| Check | Outcome |
| --- | --- |
| `npm run check:all` at 0.2.2 | PASS; TypeScript, runtime tests, 110/110 developer runner tests |
| `npm pack --dry-run --json` at 0.2.2 | PASS; `pi-sitter@0.2.2`, 86 files, dry run only |
| `git diff --check` | PASS; no whitespace errors |
| Host policy and Godot MCP qualification | NOT RUN; no implementation |
| Live Stage 05 Worker retry and host diagnostic | NOT RUN |

Do not treat the 0.2.2 package version as evidence of a fixed Godot tool route or a qualified release. Record later implementation and native evidence in a separate 0.2.3 ledger rather than replacing this record.

The owner subsequently corrected the implementation target to 0.2.3 because the manifest is already 0.2.2. The implementation prompt now requires checks before and after advancing from 0.2.2 to 0.2.3. This correction changes no 0.2.2 result above.
