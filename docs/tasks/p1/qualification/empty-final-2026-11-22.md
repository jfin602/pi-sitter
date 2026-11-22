# Empty Worker final response — 2026-11-22

**Scope:** Completion-boundary repair in the standalone Pi Sitter extension. Source baseline: `3e12415eebe89c2bca591fe0e44966a1e5d11845`, package `0.1.9`; working tree remains uncommitted. The external benchmark JSONL was read as evidence only. Its final assistant response has `stopReason: "stop"` and `content: []` after a tool result; no final Worker report or `npm test` run appears in that record.

**Implementation:** `turn_end` recognizes only successful, text-empty final responses and commits a marker with the persisted Pi assistant entry ID before one follow-up turn. The marker restores the limit on session replay. A second empty response commits a visible UNVERIFIED terminal card. The follow-up asks the Worker to finish required checks and report actual commands, results and gaps. At `agent_before_settle`, absence of a trusted controller plus approved verifier is visible even if `npm test` was discovered; discovery never authorizes or executes an acceptance suite. Final verification still runs once after the continuation, and a second empty stop cannot produce an aggregate VERIFIED completion or another automatic recovery turn.

**Evidence and commands:**

| Command | Outcome |
| --- | --- |
| `node --experimental-strip-types --test tests/empty-final.test.mjs` | PASS, 8/8. Real Pi 1.5.2 session and extension event machinery with scripted provider responses; empty and whitespace stop, second empty stop, replay, abort/error/nonempty, discovered `npm test`, no-tests and configured verifier with independent review. |
| `node --experimental-strip-types --test tests/adapter.test.mjs` | PASS, 32/32 after correcting the adapter harness to preserve an earlier Pi boundary return. |
| `node --experimental-strip-types --test tests/completion.test.mjs tests/empty-final.test.mjs` | PASS, 27/27 after removing a context refresh that disrupted recovery sequencing. |
| `npm run check` | PASS, TypeScript check. |
| `npm test` | PASS, 123/123 runtime tests. An earlier run failed 7 adapter tests because the old mock wrapper discarded the previous `turn_end` result; the harness was corrected and all 32 adapter tests passed before the final full run. |
| `git diff --check` | PASS, no whitespace errors. |

**Evidence gap:** The Pi event tests exercise the installed Pi SDK's actual `turn_end` and `agent_before_settle` paths, but use a scripted provider and host fixtures. A live benchmark model session, host-authenticated protected suite, actual approved isolated verifier execution, and independent owner acceptance were not run here. The observed benchmark session had `Protected verification: unavailable`; discovering `npm test` supplies no controller authority. The benchmark host must supply a trusted controller inventory, saved source and protected suite identities, an approved verifier plan or equivalent trusted injected runner, and independent requirement review before protected final validation can yield VERIFIED. No benchmark acceptance tests, package version, release tag, publication or Git commit were changed.
