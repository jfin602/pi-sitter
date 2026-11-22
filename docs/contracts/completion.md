# Contract — Final Completion and Requirement Coverage

**Status:** Owner Q9 approved; P8 independent requirement findings and attempt-bound replay implemented with automated tests. Native and formal qualification remain open.

Completion has **two independent axes**:

1. **Protected test gates** — trusted normalized runner outcomes `PASS | FAIL | UNVERIFIED` with separate `BLOCKED` execution state. Pi Sitter cannot override a suite result or invent tests.
2. **Original task requirements** — independent Pi Sitter review of project artifacts against each authored requirement: `VERIFIED | FAILED | UNVERIFIED`, with cited files/evidence and any limitations.

Passing all tests is **necessary but not sufficient** for a completed task. Requirements not exercised by tests still need evidence. Unsupported claims or unknown coverage remain unverified. A suspected test defect is reported; only an authorized test owner can change the suite.

Pi Sitter is advisory. The *external controller* determines the formal task/benchmark outcome based on test results, requirement findings and authorized policy. Distinguish verified functionality, code changes, test outcomes, missing evidence, and owner acceptance.

`src/completion.ts` exposes `VERIFIED | RECOVERY_REQUIRED | UNVERIFIED | BLOCKED` aggregate advisory decisions and a separate `VERIFIED | FAILED | UNVERIFIED` original requirement matrix. Tests cover uninspected requirements despite all-green Vitest, broken requirements, missing report and invalid provenance. Real model and controller closeout remain separate.

P8 implementation rule: schema 1 reports remain historical and cannot produce current `VERIFIED`. A schema 2 report must match the controller's task, stage, source, protected suite, checkpoint and run. All mandatory protected gates and tests must pass. `createPiSitter({ evidenceBroker, reviewRequirements })` lets an embedding host supply a separate review for every original requirement over the broker's current read-only source snapshot. Each VERIFIED or FAILED finding needs a source path and line, quoted observation, reason, limitations and a current allowed `pi_sitter_inspect` receipt actually issued by that snapshot during the run. The quote must occur in that inspection's result. Omitted findings become UNVERIFIED. The callback is host-owned; Worker prose and acceptance test results cannot supply findings. Without both dependencies, all original requirements remain UNVERIFIED or the attempted review is BLOCKED. The external controller still owns formal outcome.

The saved completion record carries the requirement matrix and attempt identities. Report cards, completion cards, `/sitter report`, replay and recovery eligibility require the same current run. A later blocked attempt archives an earlier report; older entries are labeled HISTORICAL. Recovery plans for old runs or changed task/suite/source are ineligible. This is automated source behavior, not manual/native Pi qualification or approval of a stable public review wire format.

## Audit sentinel: false-positive verification is forbidden

The authoritative result must compare expected mandatory gate/test inventory **and** *all* original authored requirements, not merely the set of `report.gates` supplied by a provider. In the audit, one passing export test and uninspected accessibility produced `VERIFIED` in current code, as did gate A alone when A+B were expected. Both must remain non-VERIFIED until independent coverage is demonstrated.

The full task/version and stable requirement IDs survive followup/resume even if the model sees a shortened prompt. Currently `setTask` slices task text to 700 characters; preserve the full truth in controller-owned state and keep prompt truncation separate.

Requirement findings are independently VERIFIED/FAILED/UNVERIFIED, each cited to source/run evidence. Aggregate cannot be VERIFIED if protected gates are incomplete, any requirement fails or remains unverified, provenance is stale or runner BLOCKED. The controller still owns the formal task/benchmark outcome. Report and recovery must match the current task+milestone+source+suite+run. [Audit A03/A10/A11](../tasks/p1/codebase-gap-audit.md).
