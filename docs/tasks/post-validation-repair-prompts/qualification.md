# Post-validation repair prompt qualification

**Date:** 2026-11-23 local. **Pre-task HEAD:** `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b`. **Working tree:** already dirty before this task; existing owner edits and untracked files were preserved. No commit, HEAD move, package version change, benchmark installation, live Worker run, tag, or publication was made.

## Implemented

- `src/project-diagnostic-prompt.ts` builds a bounded advisory prompt from the current host result. It leads with failed count and an inspection of an existing task-named artifact when available, quotes observations as data, keeps supplied comparisons, omits stack traces, and requires an in-place saved repair with read-back or an exact blocker. It does not promote the diagnostic to a protected result.
- `src/index.ts` uses that builder inside the existing one-retry host diagnostic continuation. The diagnostic card still stores and expands the exact prompt delivered to the Worker.
- `src/completion.ts` puts the first supported Worker action, or one bounded inspection for an unverified cause, ahead of recovery metadata. Same-snapshot retry directly states that no saved source change was observed. Task, source, suite, run, failed gate and assertion identities remain in the prompt.
- Focused deterministic tests cover the pictured 47/51 shape, omitted failures, stack traces, absent paths, contradictory details, advisory freshness and blocker wording; recovery action order, provenance, same-snapshot retry and unverified cause; native Pi scripted-provider delivery, card equality, one retry and separation from protected verification. Existing wording assertions were updated.

## Commands and outcomes

Environment: Node `v24.21.0`; repository `/home/jfin/dev/pi-sitter`; revision stayed at the pre-task HEAD above.

| Exact command | Outcome |
| --- | --- |
| `npm run check` | PASS, TypeScript no-emit check (final run) |
| `node --experimental-strip-types --test tests/project-diagnostic-prompt.test.mjs tests/recovery-causal.test.mjs tests/empty-final.test.mjs tests/adapter.test.mjs tests/completion.test.mjs` | PASS, 78/78 focused tests (final run) |
| `npm test` | PASS, 152/152 runtime tests (final run) |
| `git diff --check` | PASS, no whitespace errors (final run) |

The first focused run had 19/21 passing because two new assertions mishandled escaping and matched a negative instruction. The first full run had 150/152 passing because two older assertions expected the previous wording. Those assertions were corrected; the final runs above passed. The full suite's installed-package tests used disposable TypeScript and Python fixtures. They were not an installation into the benchmark workspace.

## Evidence gaps

- No live Stage 04 Worker comparison was run, so the effect of prompt wording on an actual repair remains unqualified.
- No protected benchmark controller run or independent owner closeout was performed. Host diagnostics remain advisory, and passing runtime tests do not certify protected acceptance or release readiness.

## Owner-authorized test-workspace installation

After the owner requested the update, installed the dirty `0.1.9` source from the same HEAD into `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/pi-config/packages/pi-sitter`. No Pi or Godot process was running in that workspace before installation. The install script preserved the game, prompts, host suite and sessions.

| Exact command | Working directory | Outcome |
| --- | --- | --- |
| `./update-pi-sitter.sh` | Meteor retry workspace | PASS; script reran `npm run check` and `npm test` (152/152), packed the source, installed and registered the local extension |
| `./start-pi.sh 04 --check` | Meteor retry workspace | PASS; Stage 04 extension and host diagnostic preflight without launching a Worker |
| `sha256sum /home/jfin/dev/pi-sitter/src/index.ts pi-config/packages/pi-sitter/src/index.ts /home/jfin/dev/pi-sitter/src/completion.ts pi-config/packages/pi-sitter/src/completion.ts /home/jfin/dev/pi-sitter/src/project-diagnostic-prompt.ts pi-config/packages/pi-sitter/src/project-diagnostic-prompt.ts && node -p "require('./pi-config/packages/pi-sitter/package.json').version"` | Meteor retry workspace | PASS; each installed/source pair matched; installed version `0.1.9` |

Installed/source SHA-256 pairs: `src/index.ts` `f31f6fddc21480d560f2fcf37246f494b260a88435f52f2147c838703756d036`; `src/completion.ts` `043a727b3ebbba8cba09e14a963a114f44ebb27a90bbe82c805e82c2599e384d`; `src/project-diagnostic-prompt.ts` `96c00293f7e26401845af30f25a44465b8dadc79e3c9cc3fd31e4bae977806df`. No live Worker or protected acceptance run was launched.
