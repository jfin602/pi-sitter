# Contract — Final Completion and Requirement Coverage

**Status:** Owner Q9 approved; independent requirement-level evidence audit requires further implementation/qualification.

Completion has **two independent axes**:

1. **Protected test gates** — trusted normalized runner outcomes `PASS | FAIL | UNVERIFIED` with separate `BLOCKED` execution state. Pi Sitter cannot override a suite result or invent tests.
2. **Original task requirements** — independent Pi Sitter review of project artifacts against each authored requirement: `VERIFIED | FAILED | UNVERIFIED`, with cited files/evidence and any limitations.

Passing all tests is **necessary but not sufficient** for a completed task. Requirements not exercised by tests still need evidence. Unsupported claims or unknown coverage remain unverified. A suspected test defect is reported; only an authorized test owner can change the suite.

Pi Sitter is advisory. The *external controller* determines the formal task/benchmark outcome based on test results, requirement findings and authorized policy. Distinguish verified functionality, code changes, test outcomes, missing evidence, and owner acceptance.

Current `src/completion.ts` exposes `VERIFIED | RECOVERY_REQUIRED | UNVERIFIED | BLOCKED` aggregate decisions; it is not yet the complete independent requirement matrix contract. Test with untested requirements despite all-green Vitest, broken requirements, missing report, invalid provenance and real completion claims.
