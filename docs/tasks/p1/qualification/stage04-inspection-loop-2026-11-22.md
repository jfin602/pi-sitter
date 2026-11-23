# Cancelled Stage 04 inspection loop — diagnosis and patch

**Source:** `5b521a6ab6eb5d696f50e29d0b4dc1f44ad7037b` plus pre-existing dirty owner work and this uncommitted patch. **Environment:** Node `v24.21.0`, npm `11.19.0`; Pi Sitter package `0.1.9`. This is a focused repair, not a release qualification.

## Observed run

Transcript: `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/04/2026-11-23T01-54-51-687Z_01a2061c-f8a6-742c-b8fe-92851705392e.jsonl`.

The Worker made 36 tool calls: one health check, one project-info read, and 34 scene-tree reads. The first scene-tree read used `{}`. The next 33 used `{"lightweight":true}` and returned byte-identical content. There were no mutations, tool errors, Pi Sitter trigger entries, or intervention entries before cancellation. `start-pi.sh` sets `PI_SITTER_MODE=active`, and the transcript has a Pi Sitter task-history entry, confirming that the extension loaded.

`src/core.ts` counted repeated successful inspections for T4 only after a failure or no-change mutation had set `recovery=true`. The Stage 04 reads were successful and never entered recovery. This explains why no trigger was emitted. The existing T1–T4 conditions and thresholds remain unchanged.

## Repair

T5 now recognizes five consecutive identical successful non-setup inspections with the same operation arguments and complete result body, before recovery. A different call or result resets the streak. Saved progress resets it and allows a new streak to trigger. T5 is bounded by the existing trigger and advisory budgets. A deterministic fallback advises the Worker to stop repeating the read and inspect a different task-relevant source or report a blocker. Two identical reads after delivered T5 guidance produce the existing visible unresolved-loop warning.

## Checks

- `npm run check` — PASS.
- `node --experimental-strip-types --test tests/adapter.test.mjs` — PASS, 36/36. Includes T5 delivery, fallback, post-advice warning, reset, and unchanged T4 recovery behavior.
- `npm test` — PASS, 136/136.
- Read-only replay of all 36 tool results from the cancelled transcript through the patched `PiSitterEngine` — exactly one T5 at `2026-11-23T01:55:41.404Z`, the fifth identical lightweight result; no later duplicate trigger. The final replay imported the installed package.
- `./update-pi-sitter.sh` in the test workspace — PASS after the final source patch; its validation reran type checking and 136/136 runtime tests, then installed the packed local source. The cancelled transcript was preserved.

The replay establishes trigger behavior on actual recorded receipts. A fresh live model run of Stage 04 is still needed to observe whether the Worker follows the advisory.

Final installed-package replay command, run from `/home/jfin/dev/pi-sitter`:

```bash
node --experimental-strip-types --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
import { PiSitterEngine } from '/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/pi-config/packages/pi-sitter/src/core.ts';
const file = '/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/04/2026-11-23T01-54-51-687Z_01a2061c-f8a6-742c-b8fe-92851705392e.jsonl';
const engine = new PiSitterEngine('active');
const calls = new Map();
for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
  const row = JSON.parse(line);
  if (row.type !== 'message') continue;
  for (const part of row.message.content ?? []) if (part.type === 'toolCall') calls.set(part.id, part);
  if (row.message.role !== 'toolResult') continue;
  const call = calls.get(row.message.toolCallId);
  const trigger = engine.observe({ toolCallId: row.message.toolCallId, toolName: row.message.toolName,
    args: call?.arguments, result: { content: row.message.content }, isError: row.message.isError ?? false });
  if (trigger) console.log(row.timestamp, trigger.type, trigger.evidence);
}
console.log('trigger count:', engine.triggerCount);
JS
```
