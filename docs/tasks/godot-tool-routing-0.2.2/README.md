# Godot tool routing — 0.2.3 implementation plan

**State:** Source and benchmark-host routing changes implemented at 0.2.3 on 2026-11-23; automated and native scripted-provider checks are recorded in [0.2.3 qualification](qualification-0.2.3.md). The local 0.2.3 working-tree package is installed in the Stage 05 benchmark workspace, whose saved game now matches the documented clean pre-05 baseline; live Stage 05 retry and protected acceptance remain open. The owner-requested 0.2.2 planning checkpoint remains separately recorded in [0.2.2 planning qualification](qualification.md). This is a standalone implementation, not a Dope phase-runner prompt.

## Observed failure

The latest Stage 05 native Pi session is `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/05/2026-11-23T14-42-29-524Z_01a208db-c213-7617-a75a-f2715f593ded.jsonl`. The Worker inspected Main and Meteor with Godot MCP and made two Main scene changes in the editor. It then sent two Pi `edit` calls for `res://scripts/main.gd`, both returning `ENOENT`. The Pi Sitter T1 intervention was delivered and received. Its next action requested `godot_scripts_read` on that resource; the Worker performed the read, then made a third Pi `edit` call with the same invalid path. It subsequently called shell `ls` on the same virtual path and searched for `main.gd`. The session ends at that search result without a final handoff, scene save, script repair, or host diagnostic. The saved `main.tscn` examined after the session did not contain `CollisionSound`.

This is not a missing Godot write capability: the benchmark's `pi-config/mcp.json` exposes `godot_scripts_write`. The launcher also exposes Pi `read`, `write`, `edit`, and `bash`. Those general tools are needed for approved testing operations, so removing `read` and `write` globally is not the fix.

Three implementation defects made the advisory weak:

1. `src/intervention-directive.ts` applies deterministic `res://` path correction only to Pi `read` and `ls`, not `edit` or `write`. The generated action therefore followed the model's suggestion to reread a file already read, without identifying the wrong mutation route.
2. `src/index.ts` serializes full edit arguments and retains only their first 256 characters. In this run the `path` field began over 3,200 characters into the JSON after a large replacement body. The Worker directive exposed a truncated code fragment and lost the decisive path even though the tool's full operation signature was retained.
3. Post-advice monitoring matches the exact full operation signature and warns only after two further ineffective matches. Changing the edit body changes that signature while the bad path persists. A successful read is evidence of existence, not saved repair. T1 deduplication also prevents the same failure signature from generating another intervention until its failure epoch changes; that existing trigger behavior must remain intact.

## Fix boundary

### Host-owned execution rule

Add a narrow, host-owned Pi `tool_call` policy to the Meteor benchmark's `pi-config/sitter-host.ts` or a separate host extension loaded by its launcher. Before dispatch, resolve the target path against the verified Godot project root. Reject Pi `write` and `edit` calls that target Godot game artifacts, whether the input uses `res://`, project-relative, absolute, traversal, or an alias through a symlink. Give a short result that names the correct Godot MCP operation and path form. Keep Pi file reads and approved testing writes available. Do not allow writes to protected acceptance criteria or suites. Treat unknown or unresolvable mutation targets as blocked, not as permitted test operations.

Do not attempt to secure arbitrary shell commands with a regex for `sed`, redirection, Python, or similar variants. The benchmark host should remove arbitrary Worker `bash` from the Godot task or route needed test execution through its already approved host diagnostic/runner; Godot smoke checks can use the exposed MCP runtime operation. If another workflow genuinely needs shell, provide an explicit host-approved command path with bounded arguments. This host policy is separate from Pi Sitter's advisory runtime and must not be embedded as Godot-specific enforcement in the standalone package.

### Pi Sitter advisory correction

Capture bounded structured target fields (`path`, `script_path`, tool name) before truncating large bodies. Never persist replacement source text in an intervention or use a clipped JSON prefix as the action label. Extend deterministic ordinary-file-tool `res://` correction to `edit` and `write` while preserving the distinction between Pi filesystem paths and Godot MCP resource paths. For a task requiring Godot MCP mutation, the directive should point to `godot_scripts_write` for `res://scripts/main.gd`; for a generic file task, it may give the equivalent project-relative Pi path. The action must come from the current operation and task/tool evidence, not from a benchmark-specific hardcoded pathname.

Keep T1–T5 triggers, thresholds, budgets, quiet on-demand inference, and advisory authority unchanged. After an advisory, distinguish a relevant saved mutation from a read or a changed edit body that repeats the same bad path. Record an unresolved outcome without creating a new trigger or continuous supervisor inference. The host rule prevents the operation; Pi Sitter explains it and reports whether a saved repair was observed.

## Qualification and version gate

1. Reproduce the captured Stage 05 tool-call sequence in deterministic fixtures. Assert that a long edit body cannot hide its path, the first wrong-route call is rejected by the host before a file changes, the Worker receives a concrete MCP route, and a later read alone does not count as repair. Include `write`, `edit`, `res://`, relative and absolute paths, symlink/traversal aliases, nested or alternate tool routes, and a permitted testing write. Verify protected test files remain blocked.
2. Check actual Pi 1.5.2 `tool_call` semantics in the local installed package and exercise the host policy in a native scripted-provider Pi session. Confirm no Godot source mutation through Pi file tools or shell, normal MCP script/scene writes and saves still work, and approved testing operations still work.
3. Run focused tests, `npm run check:all`, `npm pack --dry-run --json`, and `git diff --check` in the actual implementation environment. Record exact commands, revision, outcomes, and evidence gaps in a new qualification ledger. If the implementation is executed through a Codex child, verify its mandatory command environment before source edits as required by `docs/runner.md`.
4. The owner explicitly requested the `package.json` advance to 0.2.2 during planning. It has already been made after baseline checks, and that checkpoint remains unqualified for the proposed fix. Keep 0.2.2 during implementation; after source and host changes pass their required checks, advance to 0.2.3 and rerun those checks. Record implementation qualification separately from the 0.2.2 planning evidence. Do not commit, tag, publish, install into the benchmark, reset the game, or run a fresh Stage 05 Worker merely because this plan exists. Those are separate owner decisions and qualification steps.

**Implementation prompt:** [IMPLEMENTATION_PROMPT.md](IMPLEMENTATION_PROMPT.md).
