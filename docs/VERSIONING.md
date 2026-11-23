# Pi Sitter — Change-driven package versioning

**Status: OWNER APPROVED / DOCUMENTATION APPLIED / AUTOMATION NOT IMPLEMENTED OR QUALIFIED** (2026-11-23). Decision: [ADR 0002](decisions/0002-change-driven-versioning.md).

## Governing rule

For changes **to this Pi Sitter repository**, after the migration is qualified, **each distinct successfully completed prompt that retains tracked project changes increments the current package patch version exactly once**. This is independent of roadmap phase, prompt number or file count. Pi Sitter supervising changes in another repository does not affect Pi Sitter's own version.

| Outcome | Version change |
| --- | --- |
| Read-only research, investigation, review or status | None |
| Successful prompt retaining changes to code, docs, tests, dependencies or config | Next patch, exactly once |
| One prompt edits many files | Next patch, exactly once |
| No-op, cancelled or fully reverted prompt with no retained changes | None |
| Failed/interrupted prompt with partial retained work | Hold for explicit reconciliation; no fabricated successful checkpoint |
| Retry/resume of an already counted logical prompt | No duplicate bump |
| Explicitly approved major/minor transition | Apply owner-selected SemVer, without an extra implicit patch |
| npm publish, tag or 1.0 promotion | Separately owner-authorized; never automatic |

An example **only**: `0.1.0` → `0.1.1` after one qualifying fix → `0.1.2` after a different qualifying docs change. Never preassign these numbers to phases. A version bookkeeping edit itself does not cause a second bump.

## Deterministic implementation contract

1. Record the authoritative starting package version, source revision, dirty state, and stable logical prompt/checkpoint identity. Never absorb unowned pre-existing dirty work into the current prompt.
2. At successful completion, compare attributed tracked project changes (excluding mechanical version bookkeeping). A write-capable prompt with no retained diff does not qualify.
3. Run required checks; record failed/blocked or partially dirty outcomes honestly. Reconcile partial work before proceeding; no false successful checkpoint to force a version change.
4. Atomically choose exactly the next patch from **actual current state** and persist durable checkpoint identity so interruption/retry/resume is idempotent. Do not infer version from phase numbers or earlier estimates.
5. Synchronize `package.json` and genuinely maintained package/version metadata. This repository deliberately has `.npmrc` `package-lock=false` and **no `package-lock.json`**: do not create one. Only sync a lockfile if future owner-approved policy actually adopts one. Never rewrite historical prompt or release records as though they were new releases.
6. Verify version, changed files, successful checks and checkpoint provenance before the authorized commit. The current imported Dope runner owns commits while active; worker agents inside its tasks must not self-commit.
7. Report previous/new version, logical prompt identity, affected files, evidence gaps and checks. Version increment never triggers npm publication or tags.

## Migration requirements and execution hold

- The GitHub `main` package baseline inspected at policy approval was `0.1.0`; do not assume local workspaces remain at that version.
- The existing Dope runner and P1–P10 authored prompt stack use fixed `0.1.1`–`0.1.10` assignments and history checks. These **historical assignments are superseded**. Preserve authored prompt texts for audit; **do not execute `npm run codex:phase -- p1`** until rewritten/revalidated executable prompts, runner/checkpoint behavior and transition tests are separately approved and qualified.
- `tests/runner/pi-sitter-runner-compat.test.mjs` still assumes exactly `0.1.0` and zero runnable P1 files. Do not weaken safety, manual closeout, checkpoint/resume or original Dope runner identity tests just to force GREEN. Any wrapper/replacement or necessary runner changes require design review and regressions.
- **This documentation-only adoption does not activate the version automation or itself bump the manifest.** During implementation migration, use the then-current version, increment **once** for the successful qualifying migration, and do not invent retroactive patch releases for earlier fixes.
- Major/minor changes (including `1.0.0`), npm publication and tagging remain explicit owner decisions requiring release evidence.

## Qualification gate

Test read-only, no-op, one-file, multi-file, docs-only, tests-only, two independent prompts, failed/partially dirty, fully reverted, interrupted/resumed, concurrency/pre-existing owner work and explicit major/minor cases. Prove the next-patch sequence, exactly-once semantics, metadata agreement, preserved no-lockfile policy, old runner/manual closeout safety, and **no auto-publish**. Mark policy implementation NOT GREEN until real execution evidence proves these behaviors.

**This is a future implementation contract, not a claim the current runner already enforces it.**
