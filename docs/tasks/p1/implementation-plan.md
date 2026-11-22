# Pi Sitter 1.0 — Source-anchored implementation sequence

**Status:** DOCUMENTATION PLAN APPLIED / IMPLEMENTATION PROMPTS NOT AUTHORED / CODE NOT CHANGED / QUALIFICATION NOT GREEN.  
**Source:** `feea1c18e74d09d5db64155268eb7d75a6198dda`. [Audit A01–A12](codebase-gap-audit.md) · [owner Q1–Q10](../../decisions/0001-ten-approved-decisions.md) · [review #3](https://github.com/jfin602/pi-sitter/issues/3). Refresh source HEAD before implementation.

## Dependency ordering

| Phase | Findings | Work and proof to finish before proceeding |
| --- | --- | --- |
| **F0-R (prerequisite)** | **A01, A02** | Replace foundation-only live-project version/no-prompt assertions while preserving the original Dope scripts and synthetic 0.1.0 fixture. Capture golden pre-/at-/post-threshold T1–T4 and Off/Shadow/Active behaviors. No trigger semantics change; stop if regression |
| **P1 (gate contract)** | **A03, A04, early A10 sentinel** | Trusted controller supplies durable full requirement inventory, protected required test/gate manifest, source + suite identity. Both injected and subprocess reports use strict generic normalization. Real Vitest attributable nonzero test failures are FAIL; infrastructure errors BLOCKED. Omitted mandatory gate or uninspected accessibility cannot be VERIFIED |
| **P2 (sandbox/cadence)** | **A05, A06** | Least-privilege runtime mounts, disposable scratch, resource/process caps, no shell; milestone/final/post-repair/manual reasons with exact task/source/suite/run identities. No acceptance run after every ordinary edit |
| **P3 (research safety)** | **A07, A08** | Worker-equivalent vetted read MCPs, per-operation/args/resource host authorization incl. nested/deferred paths; capture and receipt provenance, output/time/byte caps. Unknown/mutating capability denied; restricted broker fallback remains |
| **P4 (advice/completion/UI)** | **A09, A10, A11** | Evidence-linked failure-specific repair with abstention for unsupported causes; independent VERIFIED/FAILED/UNVERIFIED requirement coverage; UI, status, replay, retry and repair tied to same current attempt; reject stale evidence |
| **P5/P6 (qualification)** | **A12** | Pack/install actual npm tarball in unrelated projects including non-Godot; end-to-end worker→failure→Sitter diagnosis→worker repair→rerun→requirements review; real Pi/MCP manual approval and source-bound R01–R11 evidence |

## Implementation ownership and boundaries

- `src/core.ts` and `src/config.ts`: task capture + **unchanged existing triggers**. A default advisory budget of 16, up-to-32 config and 16-entry history discrepancy is a **policy hold**, not an automatic fix.
- `src/gates.ts`, `src/verifier.ts`, `src/index.ts`: suite authority, strict verified run facts, isolation, checkpoint identity and consistent current report. Current v1 schema is historical under a future vNext API, not automatically a valid PASS.
- `src/broker.ts` and `src/supervisor-session.ts`: read-only MCP filtering and bounded evidence. Pi SDK tool hints are **untrusted labels**, not permissions; direct MCP tools remain disabled until qualified.
- `src/analysis.ts`, `src/prompt.ts`, `src/completion.ts`: task-scoped research, causal structured recovery and independent requirements audit. Worker owns edits; external controller owns formal gate/scoring outcome.
- `tests/runner/pi-sitter-runner-compat.test.mjs`: revise only transient compatibility assumptions. Canonical Dope runner scripts stay byte-identical. Runtime tests remain `node:test`; Vitest is an external acceptance provider through a generic adapter.

## Stop/hold and recovery rules

Stop on: (1) trigger behavior change without separate owner approval, (2) a false VERIFIED from sparse/old evidence, (3) missing protected suite authority, (4) an unclassified MCP mutator or unavailable sandbox, (5) any attempt to alter acceptance criteria, (6) stale report/replay/repair after a blocked rerun, (7) missing source-bound or manual native evidence.

For a non-GREEN phase, preserve the original failing record and append a focused correction prompt/recheck; do not rewrite historical qualification or skip phases.

**Additional design review before coding:** exact trusted task/manifest ingress, final vNext wire fields and legacy v1 read-only behavior; advisory budget cap; new provider tool-receipt semantics. The ten approved owner architecture decisions remain unchanged.

**Versioning and runner:** first valid developer checkpoint originates at `0.1.0` and continues as runner-owned `0.1.x` patches. P1 implementation prompts `P1-*.txt` to manual closeout **do not yet exist**, have not been executed, and are not authorized by this docs application. `1.0.0` remains independent owner-qualified release.

[Qualification evidence and unrun cases](qualification/README.md).
