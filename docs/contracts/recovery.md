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

The source path now carries the structured diagnostic below. Automated fixtures exercise evidence linkage and abstention; native model quality and formal outcome remain separate qualification gates.

## P7 implemented diagnostic shape (0.1.7 automated checkpoint)

`RecoveryPlan.diagnosis` carries one `RecoveryDiagnosis`: `trigger`, `status`, `task`, `milestone`, protected `suite`, `source` snapshot, `run`, failed gate and test IDs, observed failed assertions with locations, causal evidence references, probable cause, confidence and uncertainty, affected source locations, ordered Worker actions, a `post_repair` gate/test rerun request, gaps, and optional protected-suite-owner escalation. A failed test establishes a symptom; without a supported cause the status stays `UNVERIFIED` and the Worker receives bounded read-only inspection guidance. Successful approved inspection citations must carry a receipt for the same task, run and source snapshot. Passing test text, error text and stale receipts do not support a cause. The trusted runner resolves the rerun request; the supervisor has no command or write authority. This checkpoint is automated evidence only and does not qualify native model behavior or formal release.

## Audit-driven causal proof

A recommended root cause or patch must cite the **specific failing assertion/gate** or a successful approved investigation receipt for the current source+suite+run. Searching for a quote anywhere in all reported or serialized evidence is insufficient: passing gates, old failures and error metadata do not establish the proposed cause.

Required output: trigger; task/gate/run/source/suite; observed failure; relevant assertion/tool evidence; probable cause with confidence/uncertainty; affected files/functions; ordered actionable repairs; approved verification rerun; unresolved limitations. If inspected evidence is unconnected or missing, **abstain/mark UNVERIFIED** instead of asserting a generic fix. Suspected test defects go to a separate authorized suite owner. The worker performs any modifications; supervisor returns dormant. [Audit A09](../tasks/p1/codebase-gap-audit.md).
