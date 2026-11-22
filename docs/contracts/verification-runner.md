# Contract — Approved Isolated Test Runner

**Status:** Q4/Q7 approved; full least-privilege implementation and qualification pending.

- A **trusted host controller** decides which signed/approved suite and command is callable for a gate. Pi Sitter requests a gate/run ID or approved rerun only; the supervisor model cannot choose the executable, script, flags, environment, test files or privileges.
- Initial runner executes Vitest and parses its **structured** output. Other frameworks can provide the same normalized report. Never embed Vitest assumptions in Pi Sitter's reasoning core.
- Start at completed milestones, at final verification, and after worker repairs for affected gates/regressions. Existing emergency triggers are not changed by this cadence.
- Execute through a no-shell interface with a bounded working directory, explicit exec/args allowlist, environment allowlist, timeout, process termination, memory/output/file caps and bounded logs.
- Permit only narrowly required read mounts, protecting implementation and protected acceptance tests from writes; provide disposable writable temp/cache/report paths. Restrict network and dangerous subprocess/host access; clean up even on error/cancel. A read-only mount of the whole host, as in current `src/verifier.ts`, is **not** least-privilege confidentiality isolation.
- Verify source and suite identity before trusting the report. Sandbox unavailable, test-runner crash, missing report or policy violation are **BLOCKED**, not PASS.
- `src/verifier.ts` is an existing host-command adapter with `bubblewrap` and basic JSON validation, **not yet** this fully qualified contract.

Tests must cover command injection attempts, traversal/symlink/hardlink escapes, test mutation, filesystem and network boundaries, timeouts, stale source, cleanup, and false pass rejection.

## Audited boundary and checkpoint additions (not yet implemented)

Current `src/verifier.ts` clears the child environment, uses literal args, output/time cap and a network namespace, but reads all of `/` via a read-only bind, binds host devices and executes from the live project. This is **not confidentiality isolation**. Candidate implementation uses controller-provisioned protected suite/config and immutable project source, only necessary runtime read mounts, disposable scratch/cache/reports, CPU/memory/files/process/time caps, reliable child cleanup and a BLOCKED result on missing isolation.

Trusted invocation reason `milestone | final | post_repair | manual` is separate from original T1–T4 triggers, and must carry task/milestone, source/suite/run ID, approved gate subset/regression coverage. A regular edit does not run acceptance tests. Milestone verifies its subset, repaired snapshot is reverified, and final covers the required complete manifest. Missing verifier cannot be treated as success.

Subprocess nonzero return with attributable structured Vitest assertion details is FAIL; nonzero due to crash, timeout or missing/corrupt report is BLOCKED. Both subprocess and injected verifier converge on one validator. [Audit A04–A06](../tasks/p1/codebase-gap-audit.md).
