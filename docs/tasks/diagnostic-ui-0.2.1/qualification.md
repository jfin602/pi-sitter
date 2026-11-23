# Diagnostic UI 0.2.1 qualification

The owner requested source implementation and 0.2.1 versioning. Scope: Pi Sitter's own extension renderer, host diagnostic continuation card, and advisory intervention receipt display. Worker prompt construction, trigger thresholds, protected gate authority, and formal completion remain unchanged.

The literal `>` came from `quotedText` in `src/index.ts`: it prefixed expanded Worker prompt lines with Markdown blockquote markers and passed them to a plain text card renderer. The renderer showed the markers literally. The display parser now renders supported blockquotes and fenced code without changing the saved prompt or the Worker message. A raw view retains the original text; terminal controls are escaped only for display.

Qualification commands and observed results are recorded below after execution. A native interactive Pi transcript and pixel-level narrow-layout check have not been run. A host diagnostic PASS is not a protected acceptance result or independent requirement review.

## Source and results

- Baseline revision: `a54c71ea08ac98077d4088d1d29f1f59c1189110`. The changes remain uncommitted in the working tree.
- `npm run check:all`: PASS. TypeScript check passed; runtime suite 157/157 passed; developer runner suite 110/110 passed. The full command exited 0 after the final lifecycle and Markdown changes.
- `node --experimental-strip-types --test tests/diagnostic-presentation.test.mjs`: PASS, 4/4 after the final Markdown display refinement.
- `node --experimental-strip-types --test tests/empty-final.test.mjs`: PASS, 14/14 after the late-response session guard.
- `npm run check`: PASS after the late-response session guard.
- `npm pack --dry-run --json`: PASS. The package identifies as `pi-sitter@0.2.1` and includes `CHANGELOG.md` and `src/diagnostic-presentation.ts`.
- `git diff --check`: PASS, no whitespace errors.

The native Pi scripted-provider harness exercises the actual extension hooks and entry renderers, including the Stage 04 50/51 failure, exact prompt in Worker context, a single pending entry, and a 51/51 host diagnostic follow-up. It does not exercise an interactive terminal screen with a live model. The card's wheel paging was exercised through the renderer's native `wheel` event shape, not by clicking a real terminal.

Unobserved states: an ordinary T1–T5 intervention can confirm receipt in Worker context and same-tool saved progress, but it cannot confirm that the repair resolved the original issue without a later host or protected check. The host diagnostic card labels its passing follow-up as host evidence only. Copy-to-clipboard is not present in the custom entry renderer API; the full raw diagnostic and prompt remain in the saved entry and raw technical view.
