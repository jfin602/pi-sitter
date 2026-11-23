# Stage 05 final supervisor verdict — target 0.2.4

**State:** Terminal verdict source and native scripted-provider tests implemented at package 0.2.4 after the 0.2.3 checks passed. The installed benchmark package remains 0.2.3; no live Stage 05 rerun or game repair is claimed. See [implementation qualification](qualification-implementation-0.2.4.md). The earlier plan and saved run evidence below remain historical.

## Observed run

The latest saved Stage 05 session is `/home/jfin/dev/llm-zone/full-tests/gemma-4-26b-a4b-qat/Q4_0-vitest-sitter-ponytail-lite-retry-01/sessions/05/2026-11-23T18-32-39-993Z_01a209ae-7d38-75d6-be9f-a8ebe162dbec.jsonl`. Its first automatic host diagnostic at record 67 was `FAIL`, 55/66. Pi Sitter delivered one repair continuation. After the Worker saved changes and reported completion, the automatic follow-up host diagnostic at record 105 was `FAIL`, 58/66. Eight checks remained: `MD-METEOR-AREA-CONNECTION`, `MD-METEOR-STRUCK-ONCE`, `MD-INVULNERABILITY-EXPIRES`, `MD-GAMEOVER-STATE`, `MD-GAMEOVER-STOP-SPAWN`, `MD-GAMEOVER-STOP-MOVEMENT`, `MD-GAMEOVER-CLEAR`, and `MD-COLLISION-PHYSICAL`.

The owner then manually typed `/sitter verify`. Record 108 has `milestoneId: manual` and `decision: BLOCKED`, reason `Trusted controller task and protected suite are not configured`. This manual command was separate from the automatic host diagnostics. The host diagnostic did run twice; the final result was saved as an update to the earlier pending diagnostic card. It did not leave a distinct terminal supervisor verdict after the Worker's final claim. The current one-continuation diagnostic limit is intentional and must not be silently relaxed. The saved evidence establishes partial improvement, not a pass.

## Requested behavior

At each completed Worker boundary, Pi Sitter must make the final automatic host diagnostic outcome the last visible result in the transcript. Keep the existing pending card and its detailed history, then append one separate terminal verdict after the diagnostic finishes. If the host diagnostic returns PASS, the verdict states the exact passed/total host check count and labels it as host evidence. If it returns FAIL, the verdict says completion is blocked by the exact remaining failed/total count and names a bounded set of failed IDs. If execution returns BLOCKED, it gives the actual reason and says the failure count is unknown unless supported by a current trusted result. A manual `/sitter verify` must remain a distinct action and cannot overwrite the automatic terminal verdict.

Use `docs/contracts/completion.md` and `docs/verification.md` for the fail-closed status boundary. Host diagnostic PASS does not become protected acceptance or independent requirement review. The Stage 05 game still needs a Worker repair and a fresh full run of all 66 checks; presentation work alone cannot make it pass.

Do not change T1–T5 trigger rules, supervisor thresholds or budgets, the one automatic host diagnostic repair continuation, or protected acceptance criteria. Do not promote the 58/66 host result into a protected gate report. Preserve the dirty Pi Sitter checkout and existing benchmark game. No run, reset, installation, commit, tag or publication is authorized by this plan.

**Implementation prompt:** [IMPLEMENTATION_PROMPT.md](IMPLEMENTATION_PROMPT.md). **Evidence:** [qualification.md](qualification.md).
