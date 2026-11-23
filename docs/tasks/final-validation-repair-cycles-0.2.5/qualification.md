# Qualification — final-validation repair cycles (0.2.5)

**Checkout:** `/home/jfin/dev/pi-sitter`; HEAD `01d354ac09af254d6020aff50ffb60c99f98b9ca`; Node `v24.21.0`; npm `11.19.0`. The checkout was clean at the start of this task. Previous manifest version `0.2.4`; target `0.2.5`. No commit, installation, tag, publication, benchmark run, or Meteor Dodge edit is claimed.

## Results

| Exact command | Observed result |
| --- | --- |
| `node --experimental-strip-types --test tests/adapter.test.mjs tests/empty-final.test.mjs` | PASS, focused host-diagnostic and native Pi cases. An intermediate run exposed three unrelated status assertion failures caused by an accidentally shortened status string; the original fields were restored and the rerun passed 62/62. |
| `node --experimental-strip-types --test --test-name-pattern='automatic protected final validation' tests/empty-final.test.mjs` | PASS, 1/1 protected automatic final-validation case with three repairs despite `maxRecoveryAttempts: 1` and `maxCompletionVerifications: 1`. |
| `npm run check:all` at 0.2.4 | Initial run FAIL, 5/174 runtime tests, due to outdated recovery expectations and a fixture callback changed to receive host arguments. The fixture and expectations were corrected. Final pre-bump run PASS: TypeScript, 174/174 runtime tests, 110/110 developer runner tests. |
| `npm test` at 0.2.4 | PASS, 174/174 runtime tests. |
| `npm pack --dry-run --json` at 0.2.4 | PASS, version 0.2.4, 91 files. |
| `git diff --check` at 0.2.4 | PASS. |
| `npm run check:all` at 0.2.5 | PASS after version bump and final replay/budget refinements: TypeScript, 174/174 runtime tests, 110/110 developer runner tests. |
| `npm pack --dry-run --json` at 0.2.5 | PASS, version 0.2.5, 93 files including this task record. |
| `git diff --check` at 0.2.5 | PASS. |

The package version was advanced from 0.2.4 to 0.2.5 only after the full pre-bump check passed. `PI_SITTER_LIMITS` parsing and injected limits cover default 2, values 1/3/10, invalid values, and cap 10. Native Pi scripted-provider tests cover an initial check plus exactly 1, 3, or 10 repair continuations and follow-up checks, early PASS, BLOCKED, exhausted FAIL with latest IDs, and replay. Deterministic tests cover duplicate settlement and repeat `turn_end` events. The protected final fixture checks that automatic final validation can complete its configured repair count despite lower recovery and verification budgets, while retaining the protected runner's FAIL gate result.

**Evidence boundary:** This qualifies deterministic source behavior and scripted Pi event paths only. The saved Stage 05 Meteor Dodge run remains historical evidence at 58/66 host checks; no fresh benchmark run, protected acceptance, independent requirement review, or live interactive display qualification was performed.
