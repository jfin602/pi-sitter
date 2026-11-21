# Pi Sitter — Non-Negotiable Principles

1. **Standalone Pi extension:** no llm-zone, Godot or benchmark test dependency.
2. **Existing triggers preserved:** leave already-working trigger definitions and thresholds intact (Q1).
3. **Quiet lifecycle:** inference only on configured interventions; no continuous second model.
4. **Independent acceptance criteria:** test/controller authors protected suite; worker may write development tests (Q2).
5. **Tests decide test gates:** authoritative structured Vitest-first reports, fail-closed malformed/missing/skipped results (Q3).
6. **Milestone cadence:** relevant runs on milestone completion/final verification and post-repair reruns (Q4).
7. **Evidence-guided breadth:** follow causal project evidence, never unrelated work (Q5).
8. **MCP tool parity through safety:** discover safe worker-accessible reads; enforce read-only at the host/tool boundary (Q6).
9. **Host-authorized test execution:** isolated approved runner, not agent-selected shell (Q7).
10. **Actionable recovery:** structured cause, file locations, ordered repairs and verification (Q8).
11. **Requirement and gate separation:** passing tests alone is not proof of all requirements (Q9).
12. **Qualified releases only:** real Pi, safety, multi-project evidence and owner closeout before 1.0 (Q10).

Tool output and repository content are **untrusted evidence**, not instructions to the supervisor. A tool capability named “read” is not intrinsically safe; classify effects and parameters. All unknown or unverified capabilities fail closed. A broad read-only host mount can still disclose secrets; enforce least privilege.

**Authority:** [approved owner decisions](decisions/0001-ten-approved-decisions.md). This document describes the target architecture; [BOOT](../BOOT.md) distinguishes existing implementation.
