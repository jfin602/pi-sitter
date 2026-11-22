# Pi Sitter — Module and Authority Map

| Module / path | Responsibility | Authority / safety |
| --- | --- | --- |
| `src/index.ts` | Pi extension entry, commands, event bridge, supervisor lifecycle | Orchestrates, does not create benchmark criteria |
| `src/core.ts` | Worker tool observation, existing trigger rules | **Preserve existing thresholds and triggers** |
| `src/config.ts` | Inference, recovery, limits and mode settings | Current behavior; no unapproved trigger policy changes |
| `src/inference.ts`, `src/prompt.ts`, `src/fallback.ts` | Bounded diagnostic prompts/inference and fallback | Advisory, never code author |
| `src/analysis.ts` | Targeted evidence analysis | Focus failed gates / task-directed triggers |
| `src/broker.ts` | Snapshot-based inspection and provider capabilities | Deny out-of-policy reads and all mutation |
| `src/supervisor-session.ts` | Independent Pi supervisor session with restricted tools | Direct MCP **currently disabled**, Q6 pending |
| `src/gates.ts` | Generic gate evaluation types | Consumes approved inputs; does not own acceptance suite |
| `src/verifier.ts` | Host-approved external verification execution | Isolation needs further qualification |
| `src/completion.ts` | Completion and recovery summaries | Advisory; formal decision owned by controller |
| `src/view.ts` | Status/panel formatting | Display observed state truthfully |
| `tests/` | Pi Sitter's own regression and qualification fixtures | Independent of `llm-zone` |
| `scripts/codex-phase-*.mjs`, `scripts/validate-codex-phase.mjs` | Exact Dope developer prompt runner | **Not** included in Pi runtime package |
| `tests/runner/` | Developer runner regression and compatibility tests | Disposable Git/test fixtures |
| `docs/tasks/` | Bounded scoped plans and immutable executed prompt evidence | Prompts require explicit execution approval |
| `llm-zone` (external) | Benchmark prompts, protected Vitest suites, formal scoring | Only consumes pinned Pi Sitter releases |

## Authority and dependency boundaries

- **Task/test author/controller** defines protected acceptance gates. **Trusted runner** executes and normalizes them. **Pi Sitter** investigates failed evidence and evaluates requirement coverage. **Worker** edits implementation. **Benchmark controller** owns formal outcome.
- Development runner has its own Git writer for authorized prompt-stack commits; this is not a privilege granted to supervisor-model tools.
- Proposed Vitest, MCP discovery and host sandbox adapters are future modules to design against contracts; **not** present merely because this map lists their ownership.

## Source audit ownership additions (planned changes, not existing capability)

| Source | A IDs | Exact work ownership |
| --- | --- | --- |
| `src/core.ts`, `src/config.ts` | A02, A03, A10 | Preserve T1–T4 triggers, characterize receipt/tool aliases, fix only the durable full task versus bounded prompt storage; budget 16/32 discrepancy remains an owner policy hold |
| `src/gates.ts` | A03, A04 | Current v1 facts versus future controller manifest and normalized trusted acceptance inventory |
| `src/verifier.ts` | A04, A05 | Capture nonzero-assertion Vitest reports; scoped sandbox, cleanup and resource bounds |
| `src/index.ts` | A04, A06, A07, A11 | Both verifier entrypoints through validation; checkpoint/run IDs; safe research orchestration; one current verified report for cards/commands/replay |
| `src/broker.ts`, `src/supervisor-session.ts` | A07, A08 | Host filtered worker-equivalent read operations, snapshot copies and exact receipt provenance; today direct MCP access is intentionally disabled |
| `src/analysis.ts`, `src/prompt.ts`, `src/completion.ts` | A09, A10 | Evidence-specific recovery and separate requirement findings; no model-chosen acceptance outcomes |
| `tests/runner/pi-sitter-runner-compat.test.mjs` | A01 | Remove foundation-only live-check assertions, **not** Dope script SHA/no-lockfile invariants |
| `tests/pi-loader.test.mjs`, `tests/analysis.test.mjs`, new fixtures | A12 | Packed install, non-Godot end-to-end, native Pi and MCP negative/positive qualification |

Worker edits implementation; test author/controller owns acceptance requirements. The runtime verification runner, supervisor and Dope developer phase runner remain distinct authorities.
