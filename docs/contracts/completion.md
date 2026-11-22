# Contract — Final Completion and Requirement Coverage

**Status:** Owner Q9 approved; independent requirement-level evidence audit requires further implementation/qualification.

Completion has **two independent axes**:

1. **Protected test gates** — trusted normalized runner outcomes `PASS | FAIL | UNVERIFIED` with separate `BLOCKED` execution state. Pi Sitter cannot override a suite result or invent tests.
2. **Original task requirements** — independent Pi Sitter review of project artifacts against each authored requirement: `VERIFIED | FAILED | UNVERIFIED`, with cited files/evidence and any limitations.

Passing all tests is **necessary but not sufficient** for a completed task. Requirements not exercised by tests still need evidence. Unsupported claims or unknown coverage remain unverified. A suspected test defect is reported; only an authorized test owner can change the suite.

Pi Sitter is advisory. The *external controller* determines the formal task/benchmark outcome based on test results, requirement findings and authorized policy. Distinguish verified functionality, code changes, test outcomes, missing evidence, and owner acceptance.

Current `src/completion.ts` exposes `VERIFIED | RECOVERY_REQUIRED | UNVERIFIED | BLOCKED` aggregate decisions; it is not yet the complete independent requirement matrix contract. Test with untested requirements despite all-green Vitest, broken requirements, missing report, invalid provenance and real completion claims.

P2 interim rule: schema 1 reports are historical and cannot produce current `VERIFIED`. Schema 2 protected tests may produce evidence-backed `RECOVERY_REQUIRED` on explicit failed mandatory rows, but even an all-pass suite remains `UNVERIFIED` while requirement findings are not yet implemented. The external controller still owns formal outcome. This conservative rule will be revisited when the independent requirement matrix is qualified.

## Audit sentinel: false-positive verification is forbidden

The authoritative result must compare expected mandatory gate/test inventory **and** *all* original authored requirements, not merely the set of `report.gates` supplied by a provider. In the audit, one passing export test and uninspected accessibility produced `VERIFIED` in current code, as did gate A alone when A+B were expected. Both must remain non-VERIFIED until independent coverage is demonstrated.

The full task/version and stable requirement IDs survive followup/resume even if the model sees a shortened prompt. Currently `setTask` slices task text to 700 characters; preserve the full truth in controller-owned state and keep prompt truncation separate.

Requirement findings are independently VERIFIED/FAILED/UNVERIFIED, each cited to source/run evidence. Aggregate cannot be VERIFIED if protected gates are incomplete, any requirement fails or remains unverified, provenance is stale or runner BLOCKED. The controller still owns the formal task/benchmark outcome. Report and recovery must match the current task+milestone+source+suite+run. [Audit A03/A10/A11](../tasks/p1/codebase-gap-audit.md).
