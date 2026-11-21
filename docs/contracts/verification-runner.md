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
