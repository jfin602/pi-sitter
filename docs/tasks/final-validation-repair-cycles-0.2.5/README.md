# Configurable automatic final-validation repairs — 0.2.5

**Scope:** Replace the one-time host diagnostic retry flag with a separate repair-continuation budget. The owner requested a default of 2, with configured values from 1 to 10. Count a cycle when a continuation is committed, then revalidate when the Worker finishes. Keep protected acceptance, manual verification, and supervisor inference budgets distinct.

The implementation covers host project diagnostics and automatic protected final recovery. It preserves the host diagnostic's PASS, FAIL, or BLOCKED status, and records the latest failure counts and IDs when repairs are exhausted. Session replay restores committed counts and suppresses duplicate settlement verdicts. No Meteor Dodge workspace or host test was changed. See [qualification](qualification.md).
