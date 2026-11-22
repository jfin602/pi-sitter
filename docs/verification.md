# Verification protocol

**Historical v1 protocol.** Schema 1 reports remain renderable history and cannot authorize a current successful verification. P3 requires the controller-owned schema 2 identities, run ID, exact test counts and execution status described in [the gate report contract](contracts/gate-report.md). The configured verifier emits one machine-readable JSON object on stdout. A nonzero assertion exit can produce `FAIL` only when the structured report attributes the failure to mandatory tests; infrastructure failure, malformed output or identity drift blocks the run. The independent original-requirement audit remains pending.

A trusted runner writes a single `GateReport` JSON object to stdout. Pi Sitter passes the task label as `PI_SITTER_STAGE` and the project path as `PI_SITTER_PROJECT_ROOT`. The runner must use saved project evidence and give a separate result for each requirement. It should return `UNVERIFIED` when evidence is insufficient.

```json
{
  "schemaVersion": 1,
  "stage": "current",
  "snapshotIdentity": "64-character SHA-256 of the inspected saved state",
  "snapshotFiles": 3,
  "source": "explicit",
  "counts": { "PASS": 1, "FAIL": 0, "UNVERIFIED": 0 },
  "gates": [{
    "id": "BUILD",
    "requirement": "The project builds",
    "source": { "path": "task", "line": 1, "promptSha256": "source digest", "sourcePrompt": "Build the project" },
    "method": { "kind": "command", "fact": "build" },
    "fromStage": "current",
    "result": "PASS",
    "evidence": "Exact command result or saved-file evidence",
    "explanation": ""
  }],
  "regressions": [],
  "missingDeliverables": [],
  "validationLimitations": []
}
```

The schema 1 example above is historical only. Current schema 2 verification requires the trusted controller inventory and [P4 host plan](contracts/verification-runner.md): PI_SITTER_VERIFY_COMMAND names an approved host plan, rather than containing executable arguments. The Linux adapter uses copied read-only source and suite views plus disposable scratch; missing isolation blocks verification.

For adapters using `createPiSitter`, `verify(stage, projectRoot, { signal, previous, ctx })` returns the same report. The optional `EvidenceBroker` can provide immutable snapshots for further inspection. The adapter must restrict capabilities to safe reads; Pi Sitter's default policy does not grant arbitrary shell or editor tools.
