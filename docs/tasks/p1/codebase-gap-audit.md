# Pi Sitter P1 — Source-backed gap audit A01–A12

**Status:** REVIEWED FINDINGS APPLIED TO DOCUMENTATION / CODE, TESTS AND PROMPTS NOT IMPLEMENTED OR QUALIFIED.  
**Audited revision:** [`feea1c1`](https://github.com/jfin602/pi-sitter/commit/feea1c18e74d09d5db64155268eb7d75a6198dda); package `0.1.0`.  
**Audit origin:** owner's 2026-11-21 `pi-sitter-architecture-audit.md`; [GitHub review #3](https://github.com/jfin602/pi-sitter/issues/3); [owner architecture decisions Q1–Q10](https://github.com/jfin602/pi-sitter/issues/1).

The following evidence and 12 item definitions are preserved from the approved review. Each change is **unchecked/not yet implemented** and must be qualified separately.

## Executive disposition

The source-backed priority is **completion correctness and evidence ownership before adding Vitest or MCP autonomy**. Current `decideCompletion` counts only rows in a supplied GateReport and can return `VERIFIED` for a report with an omitted mandatory gate or an uninspected requirement; `setTask` saves only the first 700 characters. Future work must not validate success from the report producer's claimed inventory.

Keep existing Pi worker triggers and delivery logic unchanged unless a **separate owner decision** authorizes behavioral changes. The development runner port, node:test regression suite and source package are real foundations, not runtime acceptance-gate qualification.

**Observed vs prospective:**
- **Observed in audit:** false `VERIFIED` on incomplete gate/requirement evidence; >700-character task truncation; plain-text successful edit/write events classified `UNKNOWN`; foundation-only assertions lock CI to zero prompts and package 0.1.0.
- **Confirmed by source:** `src/completion.ts` counts report rows; `src/gates.ts` uses schema v1; `src/verifier.ts` mounts `/` read-only and parses stdout only on zero subprocess exit; `src/supervisor-session.ts` permits only `pi_sitter_inspect`; `src/index.ts` and report renderer use existing report/attempt state; direct MCP tool parity is disabled.
- **Proposed/NOT QUALIFIED:** protected suite identity, strict Vitest adapter, scoped sandbox, real worker-equivalent safe MCP, independent requirement matrix, source-bound replay and release closeout.

## The 12 audit findings — specific proposed acceptance

### F0-R: two prerequisites before authoring/running P1

**A01 — Replace transitory developer-runner compatibility assertions**  
Source: [`tests/runner/pi-sitter-runner-compat.test.mjs` lines 23–57](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/tests/runner/pi-sitter-runner-compat.test.mjs#L23-L57).  
- **Finding:** tests assert `pkg.version === '0.1.0'` and zero `P*-*.txt` files, so the first legitimate version bump or prompt stack will break CI.
- **Document proposed change:** Maintain Dope runner's original three byte-SHA checks, no-lockfile and synthetic `0.1.0` baseline fixtures; replace only the permanent repository-state assertions with a checkpoint-compatible invariant and actual prompt-grammar/closeout validation.
- **Acceptance:** baseline and legitimate `0.1.1`/real planned stack pass; malformed stack, unexpected checkpoint and changed original runner fail; CI verifies the transition. This is **not** approval to change the original Dope scripts.

**A02 — Capture existing trigger thresholds and lifecycle regressions, no redesign**  
Source: [`src/core.ts` lines 230–316](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/core.ts#L230-L316); [`src/config.ts` lines 29–51](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/config.ts#L29-L51); [`tests/adapter.test.mjs`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/tests/adapter.test.mjs).
- **Finding:** T1 two equivalent failures; T2 two-enable/three-discovery and repeated setup; T3 configured final validator; T4 no-change/repeated-inspection. Observation names `save_scene`, `scene_tree`, `get_parse_errors`, `open_scene`, setup tools are assumptions to characterize. Plain-text successful `edit`/`write` may classify `UNKNOWN`.
- **Document proposed change:** Add a source-anchored trigger inventory and before/at/after threshold characterization; preserve Off/Shadow/Active, duplicate suppression, progress reset, cancel/reload and current worker delivery. Stage a separate compatibility adapter if needed, **without** silently changing actual triggering.
- **Hold:** default advisory budget 16, config allows up to 32, live accounting history capped at 16. Document as **UNRESOLVED POLICY / DO NOT AUTO-FIX** under Q1.
- **Acceptance:** golden event fixtures behave identically in existing supported scenarios before/after integration; new provider-specific receipts are characterized separately. No implied approval to broaden or narrow triggers.

### P1 — Authoritative evidence and completion inputs (before async verifier autonomy)

**A03 — Trusted controller owns durable complete task and acceptance manifest**  
Source: [`src/core.ts` setTask](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/core.ts#L211-L214), [`src/gates.ts`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/gates.ts), [`src/index.ts` verification](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L322-L359).
- **Document proposed change:** Store a full requirements inventory (stable requirement IDs, original text reference/version) separate from bounded inference prompt text. Host/controller owns expected gate IDs, mandatory test IDs, suite ID/version/digest, source snapshot and task identity. Protect benchmark acceptance suite outside worker/Pi Sitter write authority.
- **Acceptance:** a >700-character requirement survives followup/resume and participates in final review; omitted mandatory gate, changed source, wrong suite or incomplete declared tests cannot pass; worker-authored development tests never redefine scored acceptance tests.
- **Owner review required before implementing:** contract for authoritative task/manifest input and legacy-v1 read behavior; do not invent the accepted public field layout.

**A04 — Normalize structured Vitest results through one validation path**  
Source: [`src/verifier.ts` lines 16–34](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/verifier.ts#L16-L34), [`src/index.ts` injected path](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L343-L359), [`docs/contracts/gate-report.md`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/docs/contracts/gate-report.md).
- **Document proposed change:** Both host-command verifier and dependency-injected verifier must go through the same strict framework-neutral normalizer *before* storage, UI status or recovery. Include test/gate identifiers, executed/skipped counts, assertion details, evidence locations, run status, source/suite/manifest identity and bounded payloads.
- **Important:** Vitest's normal assertion failures may exit nonzero; capture structured output while distinguishing attributable assertion failure from infrastructure crash/timeout/bad report. Today `execFile` rejection can prevent reading stdout.
- **Acceptance:** real passing, attributable failing, skipped, partially covered, duplicated, malformed, timed-out and crashing suites produce correct PASS/FAIL/UNVERIFIED/BLOCKED behavior. Preserve old schema v1 as labeled historical evidence; no silent upgrade to a successful new run.

### P2 — Controlled execution on the correct source

**A05 — Narrow host verification isolation**  
Source: [`src/verifier.ts` lines 7–25](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/verifier.ts#L7-L25), [`tests/verifier.test.mjs`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/tests/verifier.test.mjs).
- **Document proposed change:** Replace host-wide read mount and live-project execution with minimum runtime mounts, approved source snapshot, external protected suite/config, disposable writable temp/cache/report directories and explicit limits for CPU, memory, output, files, time and child processes. No arbitrary supervisor shell or test modification. Isolation unavailable → BLOCKED.
- **Acceptance:** unrelated host files cannot be read; source and protected suite cannot be altered; scratch is usable; interrupt/timeout cleans up; unsupported sandbox fails closed.

**A06 — Identify milestone, final and repair verification attempts**  
Source: [`src/index.ts` settlement hooks](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L854-L891), [manual verify](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L1001-L1023).
- **Document proposed change:** Trusted `reason = milestone | final | post_repair | manual`, task/stage ID, source/run ID, approved subset and required regressions. One milestone runs its own relevant set; final covers all required gates; repair reruns on *new* source. No tests every edit. Preserve existing emergency triggers/retry budgets.
- **Acceptance:** no unexpected per-edit run; correct subset, final coverage and rerun provenance; missing configured verifier causes visible BLOCKED.

### P3 — Research access with enforced safety

**A07 — Worker MCP capability discovery and supervisor integration**  
Source: [`src/index.ts` diagnosis](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L383-L411), [`src/supervisor-session.ts`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/supervisor-session.ts#L20-L85).
- **Document proposed change:** Discover trusted worker-accessible tools, then expose only separately vetted read operations. Enforce operation/args/resource policy at dispatch (including nested/deferred/codemode routes), record allowed/denied calls, preserve worker permissions and quiet supervisor lifecycle. Keep restricted snapshot-inspection path as fallback; direct MCP remains disabled until qualified.
- **Pi SDK note:** Pi 1.5.2 `getAllTools()` reports configured metadata; `getActiveTools()` reports model declarations, not a universal revoke. Server `readOnlyHint` is author supplied and **not a security guarantee**; isolated SDK sessions require explicit MCP extension loading. [Pi SDK types](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/src/core/extensions/types.ts#L1814-L1827) · [MCP docs](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/mcp.md#L252-L274).
- **Acceptance:** real worker and supervisor both access approved read operation; mutating/indirect operation denied by host; no privilege changes to worker; no idle model calls.

**A08 — Snapshot/receipt provenance and bounded capture**  
Source: [`src/broker.ts` capture/inspection](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/broker.ts#L41-L149), [`src/supervisor-session.ts` receipts](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/supervisor-session.ts#L47-L64).
- **Document proposed change:** Retain path and symlink protections, file/byte caps and digest; add time/resource bounds *during capture*, verify copied bytes, limit provider paths and output, tie receipts to exact task/turn/tool args/source snapshot.
- **Acceptance:** stale/out-of-scope/provider-error evidence cannot support diagnosis; captured output and tool call budgets stop resource exhaustion, with labeled uncertainty rather than fabricated success.

### P4 — Actionable recovery, requirement matrix and accurate UI/replay

**A09 — Bind repair advice to the failing assertion or successful approved inspection**  
Source: [`src/prompt.ts`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/prompt.ts), [`src/analysis.ts` lines 85–103](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/analysis.ts#L85-L103), [`src/completion.ts` lines 42–64](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/completion.ts#L42-L64).
- **Document proposed change:** Require trigger, failure, gate/run/snapshot IDs, relevant evidence references and exact locations, probable cause with confidence, affected files/functions, ordered repair steps, trusted rerun and remaining uncertainties. Quote validation must not accept unrelated passing-gate evidence or generic serialized error text as causal proof.
- **Acceptance:** multi-file defect yields causal, cited repair; unrelated quote/evidence yields abstention, not invented certainty; worker edits and Sitter returns quiet; suspicious acceptance-test defect escalates to separate test owner.

**A10 — Independently evaluate every original requirement**  
Source: [`src/completion.ts` lines 27–39](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/completion.ts#L27-L39), [`src/core.ts` task capture](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/core.ts#L211-L214).
- **Document proposed change:** Requirement-level VERIFIED/FAILED/UNVERIFIED with cited evidence; protect full task/version across sessions and followups; aggregate success requires both complete authoritative protected test gates **and** independent requirement coverage. Controller retains final scoring.
- **Acceptance:** all tests green + uncovered accessibility remains UNVERIFIED; broken requirement is FAILED; requirement after character 700 remains auditable; no fabricated VERIFIED from sparse reported rows. **This is the first correctness release blocker**, even if implementation is sequenced with P1 schema input and P4 investigator.

**A11 — Bind UI, replay, recovery and retries to one verified attempt**  
Source: [`src/index.ts` cycle reset](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L195-L203), [renderer](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L479-L497), [replay](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L643-L675), [report command](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/src/index.ts#L1035-L1045).
- **Document proposed change:** Stable composite identity `task + milestone/stage + source + suite + run`. Differentiate historical v1 evidence, current report, current decision and current recovery. `/sitter report` and cards consume the *same* validated outcome instead of recomputing status from old rows.
- **Acceptance:** blocked rerun never shows former PASS or stale failed evidence as current; tasks sharing a stage do not collide; suite changes at same snapshot and session resumes remain truthful; no obsolete recovery is delivered.

### P5–P6 — Independent release evidence

**A12 — Cross-project packed-extension + genuine Pi/MCP qualification**  
Source: [`tests/pi-loader.test.mjs`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/tests/pi-loader.test.mjs), [`tests/analysis.test.mjs`](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/tests/analysis.test.mjs), [CI workflow](https://github.com/jfin602/pi-sitter/blob/feea1c18e74d09d5db64155268eb7d75a6198dda/.github/workflows/runner-preflight.yml).
- **Document proposed change:** Real `npm pack`/tarball install, extension load from unrelated projects, complete worker→failed check→diagnosis→repair→rerun→requirements audit, non-Godot fixtures, denied MCP mutations and native Pi manual check. Cover all new fixture paths in CI triggers.
- **Acceptance:** source-bound evidence logged for R01–R11; manual Pi/MCP and owner review separately signed off. Formal llm-zone uplift comparison comes after qualified release, not a release prerequisite.

## Qualification truth to preserve (not inflated)

- [GitHub Actions run 44943269353](https://github.com/jfin602/pi-sitter/actions/runs/44943269353): **109/109** Dope developer-runner tests and **47/47** Pi Sitter regression tests passed, TypeScript check passed; package dry-run listed 35 files on audited `feea1c18`. These results prove only the executed baseline tests.
- Audit-local checks: **109/109** runner tests, **3/3** analysis tests, and dry-run passed; direct in-memory counterexamples above. Local network namespace blocked isolated verifier test in audit environment; it passed in CI. Do not combine into a fictitious 1.0 PASS.
- **R01–R11 remain not fully qualified as 1.0 release gates**; later positive/negative runs need actual commits/source/SHA/env/expected/observed/artifacts and manual closeout.

## Open policy issues (do not infer approval)

1. **Task/manifest ingress and legacy v1**: precise trusted-controller API and readonly historical v1 behavior need a targeted reviewed design. Prioritize this before implementation because it determines completion truth.
2. **Advisory budget cap mismatch**: config accepts up to 32 but history tracking is capped at 16; preserve Q1 behavior pending owner-specific decision.
3. **New tool-observation integration**: classification of ordinary edit/write receipts across providers is a *characterization* item, not permission to change working triggers.
4. **Version checkpoint**: old synthetic 0.1.0 fixture remains valid, but live project compatibility asserts must accommodate runner-owned 0.1.x checkpoints. No 1.0 tag or publish by a docs review.
5. **No hidden changes to benchmark authority**: llm-zone owns scored acceptance and formal uplift; Pi Sitter core remains general-purpose.

## Implementation disposition

Nothing in the original audit establishes finished 1.0 behavior. No existing T1–T4 trigger behavior is authorized to change; default/configurable budget mismatch and new provider receipt interpretations remain policy/compatibility holds. [Phased plan](implementation-plan.md) · [Qualification ledger](qualification/README.md).
