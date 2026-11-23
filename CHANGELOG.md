# Changelog

## 0.2.5 — 2026-11-23 (configurable final-validation repairs)

- Add a separate automatic final-validation repair limit, defaulting to 2 and configurable from 1 to 10 through `PI_SITTER_LIMITS` or injected limits.
- Revalidate after each committed Worker repair, stop early on pass or blocked diagnostics, and record the repair count in status and validation history. Keep manual verification and host diagnostic status separate from protected acceptance.

## 0.2.4 — 2026-11-23 (terminal host validation verdict)

- Append a distinct final host diagnostic verdict after the latest automatic check, with run identity, exact counts, failed IDs, and saved progress reference. Preserve the existing pending and detailed diagnostic card and the single repair continuation.
- Mark earlier automatic verdicts historical on a new Worker cycle, fail closed on malformed or interrupted diagnostics, and keep manual protected verification separate with an explicit protected gate count.
- Add deterministic and native Pi scripted-provider coverage for the saved Stage 05 55/66 to 58/66 failure pattern, later PASS, replay, interruption, and manual verify. This source change does not claim a fresh Stage 05 game pass or protected acceptance.

## 0.2.3 — 2026-11-23 (source and host routing fix; live retry pending)

- Preserve bounded edit/write target paths in Pi Sitter advice and direct Godot script repair through the exposed MCP write route. Record repeated wrong-path attempts after guidance without changing supervisor triggers.
- Add a benchmark-host pre-execution guard for Pi file mutations, retain approved testing output writes, and remove unrestricted Worker shell access from the Godot launcher. Host fixture and native scripted-provider checks passed; no live Stage 05 retry or protected acceptance is claimed.

## 0.2.2 — 2026-11-23 (planning checkpoint; runtime fix pending)

- Record the Stage 05 Godot tool-routing failure, scoped fix plan, and implementation prompt. This package version does not yet include the proposed host guard or advisory correction.

## 0.2.1 — 2026-11-23

- Render intervention Markdown readably while retaining the original diagnostic and Worker prompt.
- Show compact, structured Pi Sitter diagnostic cards with expandable technical details and verification progress.
- Show pending analysis immediately and update one host diagnostic card through guidance and a follow-up result.
- Distinguish guidance supplied, guidance received, observed Worker progress, and host-verified repair; unresolved repairs retain warning styling.
