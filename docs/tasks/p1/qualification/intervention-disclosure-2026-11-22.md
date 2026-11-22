# Intervention disclosure qualification — 2026-11-22

## Scope and identity

- Pre-change HEAD: `3e12415eebe89c2bca591fe0e44966a1e5d11845`; package version remains `0.1.9`. The working tree already contained unrelated owner edits. No commit, version change, release, or installed-package replacement was made.
- Pi Sitter stores the exact advisory text returned for the Worker continuation in the terminal intervention event. Rejected supervisor text is bounded to 3,000 characters per response and retained separately from Worker guidance. A rejected reply is never delivered as advice.
- Terminal cards show a muted “Click to show more” line when detail exists. Click or Pi's existing expanded view reveals the Worker prompt or rejected replies as quoted lines, with explicit labels. Pending cards and old events without detail remain compact. The persisted terminal event supports replay after session reload.

## Checks in the local execution environment

Node `v24.21.0`, npm `11.19.0` in `/home/jfin/dev/pi-sitter`.

| Exact command | Outcome |
| --- | --- |
| `node --experimental-strip-types --test tests/advisory-evidence.test.mjs tests/adapter.test.mjs tests/intervention-lifecycle.test.mjs` | PASS, 41/41 before the final host-container mouse fixture. Covers exact Worker prompt equality, click expansion and collapse, two rejected replies, no Worker prompt on failure, and replay. |
| `node --experimental-strip-types --test tests/adapter.test.mjs` | Initial attempt FAIL at module import: the test imported `dispatchMouseEvent` from a package root that does not export it. Corrected the fixture to use the exported `Container.handleMouse`; final attempt PASS, 33/33. This checks mouse routing through the same container type used by Pi's custom transcript component. |
| `npm run check` | PASS, TypeScript check. |
| `npm test` | PASS, 125/125 before the control-byte display fixture. After it, FAIL, 124/125: an unrelated parallel verifier test hit its wall-clock timeout before its expected stdout limit. |
| `node --experimental-strip-types --test tests/verifier.test.mjs` | PASS, 7/7 after the parallel timeout. |
| `node --experimental-strip-types --test --test-concurrency=1 tests/*.test.mjs` | PASS, 126/126 after the final control-byte fixture. The test count increased because unrelated owner work added a verifier test in the shared working tree. |
| `git diff --check` | PASS. |

## Evidence limits

- Mouse behavior was exercised through the extension renderer and Pi's `Container` mouse routing. A native interactive Pi terminal click and screen layout were **NOT RUN**. These automated checks do not qualify event-to-pixel behavior in the active benchmark terminal.
- Rejected raw text is escaped for terminal control bytes before display; the persisted response retains its original bounded bytes. The delivered Worker prompt passes normal field validation and is shown in the same quoted layout.
- The existing Stage 02 warning predates this change. Its session record contains only the rejection reason, so the missing raw model replies cannot be reconstructed for that historical event.
- The active benchmark workspace still has its previously installed package. The current dirty source contains unrelated owner work, so this task did not replace that installation or restart its running session.
