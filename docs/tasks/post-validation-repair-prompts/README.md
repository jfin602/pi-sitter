# Post-validation repair prompt plan

**Status:** The owner authorized implementation on 2026-11-23. Runtime prompt changes and focused tests are implemented in the dirty checkout; see [qualification](qualification.md). The original plan below remains the design record. The screenshot at `/home/jfin/Pictures/update-repair.png` is evidence of a delivered prompt, not an instruction source.

## Observed problem

The Stage 04 screenshot shows an advisory host diagnostic with 47/51 passing checks. The Worker continuation starts with a long general paragraph; the three actionable mismatch rows appear only afterward. It says to make one supported repair, but does not say which observation to inspect first or what saved-state check should end that step. This can invite another diagnosis or a final promise without a persisted repair. Better wording may help, but the screenshot does not prove a wording change will improve the live Worker outcome.

There are two relevant prompt paths:

1. `src/index.ts` builds the one-time host diagnostic retry from `ProjectDiagnosticResult`. This is the path pictured. It is advisory and cannot certify completion.
2. `src/completion.ts` builds recovery text after trusted protected-gate failure, plus a same-snapshot no-progress continuation. This path has stronger provenance but puts several metadata lines ahead of the first repair action.

The existing `src/intervention-directive.ts` is the pattern to follow: lead with a direct command, name the observed ineffective operation or mismatch, give one grounded next action, and require a saved-state check or a precise blocker report. Preserve its distinct trigger behavior; do not unify the two validation authorities.

## Proposed prompt contract

1. **Lead with the repair decision.** State the failed check count and whether the evidence is an advisory host diagnostic or a trusted protected-gate report. Say that the original task remains unfinished. Put the first concrete action in the first few lines, before metadata or general cautions.
2. **Turn each selected failure into an observation and next check.** Show `ID: expected versus observed` when those values are actually supplied. For the first selected failure, direct the Worker to inspect the existing saved artifact named by the original task or current evidence, repair it in place if the mismatch is confirmed, save it, and read it back. Do not infer a root cause or invent a path from a gate ID. If no grounded artifact or action exists, request one bounded inspection and an exact blocker if that cannot be done.
3. **Keep the work bounded.** Present a short ordered set of current mismatches and the count omitted by the display limit. Ask for one supported persisted change at a time, then a saved-state check before moving to the next mismatch. Preserve passing behavior and earlier-stage requirements. Do not instruct a Worker to edit host or protected tests.
4. **Give an explicit exit condition.** The Worker should finish only after carrying out the original source repair and reporting the saved changes, observed checks, and remaining failures. A diagnostic rerun is host controlled; the prompt should not tell the Worker to invoke an unapproved test command or claim a PASS. A genuine task-defined blocker permits an exact failed-operation and remaining-work report. Timed-out captures are inconclusive.
5. **Mark evidence freshness.** A diagnostic describes the saved state at its run, and may be stale after a change. A protected recovery prompt must retain task, source, suite, run, failed gate, and assertion identities. On a same-snapshot no-progress retry, say plainly that no saved change was observed; give the same supported action or bounded inspection once, rather than burying the failure in repeated metadata.

## Draft shape for the pictured diagnostic

The following is an example of ordering, not a prescribed Meteor repair or a claim that these observations are still current. Exact expected/observed values must come from the host result, and file targets must come from the task or saved evidence.

> Pi Sitter host diagnostic: 4/51 checks failed in the saved project. Repair the original task now; this diagnostic is advisory.
>
> Start with `MD-METEOR-ROOT`: the saved Meteor scene root was reported as `meteor:Area2D`; the check expected `Meteor:Area2D`. Inspect the existing scene, change it in place if the saved state confirms this mismatch, save it, and read it back.
>
> Next investigate `MD-SPAWN-VARIANTS` (reported empty variant names) and `MD-SPAWN-SPEEDS` (reported zero speeds). Inspect the saved spawn implementation and repair only what its evidence supports. Check the saved result after each change.
>
> Report what you changed, what you checked, and any remaining failure or exact blocker. Do not claim the diagnostic passed until a new host result shows it.

For a generic failure with no grounded artifact, replace the scene-specific sentence with: “Start with `<ID>`: `<observed mismatch>`. Inspect the task-named saved artifact related to this check. If it does not identify a safe repair, report the missing evidence and exact blocker.” Do not fabricate a file or an expected value.

## Implementation sequence after approval

1. Add a small deterministic host-diagnostic prompt builder beside the existing concise failure formatter. It should accept only the bounded current result and grounded task/receipt context, sort failures consistently, put the first action before the remaining rows, and retain the existing one-retry limit and exact displayed prompt. Avoid parsing stack traces as instructions. Keep the host result schema unchanged initially; add optional structured artifact/expected/observed fields only if real fixtures demonstrate that current details cannot support a useful first action.
2. Reorder `renderRecovery` in `src/completion.ts` so a supported causal repair starts with its first evidence-backed Worker action; an `UNVERIFIED` cause starts with one bounded inspection. Keep source/suite/run and all failed assertions in the prompt after the action. Make `noProgressRecoveryPrompt` explicitly state the unchanged snapshot and repeat the appropriate safe action or blocker path.
3. Update the diagnostic and recovery cards only as needed to show the first action and preserve the exact full Worker prompt on expansion. Do not change triggers, thresholds, verifier scheduling, retry budgets, or trust boundaries.

## Verification before installation or live use

- Golden prompt tests for the pictured 47/51 result, multiple and omitted failures, stack traces, missing path or expected value, contradictory details, a stale result after a saved edit, and a true blocker. Assert the first action is early, grounded, and does not prescribe recreating an existing resource or editing tests.
- Recovery tests for supported and unverified diagnoses, same-snapshot no-progress retry, protected identities and failed assertions, and current versus stale evidence. Assert no invented cause or unapproved command.
- Native Pi scripted-provider test: the exact prompt displayed on the diagnostic card is delivered once, a second diagnostic does not create another repair continuation, and protected verification remains separate. Then run type checking, the focused tests, full runtime tests, and diff checks; record the current revision and exact outcomes.
- After separate execution authorization, use a preserved Stage 04 starting snapshot for a live Worker comparison. Record whether the Worker inspects the named saved artifact, makes an in-place saved repair, reads it back, and reports the next host result accurately. A single improved result is evidence for this run, not general proof that wording alone is sufficient.

**Boundaries:** Pi Sitter remains advisory; the Worker owns implementation changes, and the host/controller owns tests and formal results. This plan does not authorize source edits, installation, a benchmark rerun, or a release.
