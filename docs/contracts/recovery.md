# Contract — Evidence-Backed Recovery

**Status:** Owner Q5/Q8 approved; field schema and final diagnostics remain design targets.

Trigger: an existing configured non-test event or verified failed gate. Evidence-guided research starts with that event/gate and follows only causally relevant dependencies, files, diffs, logs and permitted MCP resources.

## Required recovery package

- Trigger type, active task, stage/milestone and failed gate ID(s).
- Suite/run and inspected source snapshot identity.
- Observed failure, exact test assertion or tool failure, trustworthy evidence refs/quoted snippets.
- Probable root cause, confidence and explicit uncertainties; state when a suspected test defect needs separate human/test-owner review.
- Affected source files/functions/components and **ordered concrete repair steps**.
- Verification command/gate rerun request (via trusted runner; never arbitrary supervisor command).
- Unresolved evidence gaps and boundaries: preserve passing functionality, avoid unrelated edits and never rewrite acceptance criteria.

Pi Sitter issues the plan, returns dormant and leaves all implementation to the worker. The worker repairs; the trusted test runner reevaluates. Do not keep a continuously active second agent session during repairs.

Current `src/completion.ts` offers a recovery plan and `src/analysis.ts` may add inspected evidence; this does not prove all required structured fields or quality gates pass yet. Qualification needs realistic unrelated failures, high-specificity repairs and abstention when evidence is inadequate.

## Audit-driven causal proof

A recommended root cause or patch must cite the **specific failing assertion/gate** or a successful approved investigation receipt for the current source+suite+run. Searching for a quote anywhere in all reported or serialized evidence is insufficient: passing gates, old failures and error metadata do not establish the proposed cause.

Required output: trigger; task/gate/run/source/suite; observed failure; relevant assertion/tool evidence; probable cause with confidence/uncertainty; affected files/functions; ordered actionable repairs; approved verification rerun; unresolved limitations. If inspected evidence is unconnected or missing, **abstain/mark UNVERIFIED** instead of asserting a generic fix. Suspected test defects go to a separate authorized suite owner. The worker performs any modifications; supervisor returns dormant. [Audit A09](../tasks/p1/codebase-gap-audit.md).
