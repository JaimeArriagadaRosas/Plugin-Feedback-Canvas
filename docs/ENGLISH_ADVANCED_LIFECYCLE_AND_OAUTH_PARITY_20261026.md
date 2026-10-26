# Advanced startup, OAuth and Spanish parity — 26 Oct 2026

## Scope and verified changes
Branch `english-version`. The early shutdown controller is now attached before `configureMode` runs lengthy Canvas/Docker/LTI work, and accepts late-bound backend/orchestrator references. Interrupts during this phase use a cancellation exit code 130; startup failures have exit code 1. Previously tested post-startup shutdown remains idempotent.
- New `apps/installer/tests/unit/early-shutdown.test.js`: pre-start cancellation and failure states verified (2/2).
- Previous real option-3 startup/shutdown verified two successive cycles exiting 0 without leftover listeners at 3000/5173/8443; those were before the early-cancellation modification, so the new early phase is unit-tested, not fully E2E-confirmed.
- No real stored OAuth credentials were changed as part of this investigation.

## Critical OAuth races demonstrated by new isolated tests
`apps/server/tests/unit/token-refresh-multiprocess-race.test.js`: 2 tests describe existing unsafe behavior, **not accepted fixes**.
1. Two separate CanvasTokenManager instances each issue refresh calls for the same Canvas identity. The in-memory Promise map deduplicates within one instance only, not between processes.
2. A refresh response arriving after another actor deletes a credential can write it back via UPSERT, effectively resurrecting a disconnected credential. The app does not yet expose a secure user-driven Disconnect Canvas API; do not attach revocation semantics to ordinary local/LTI browser logout.

## Proposed follow-up schema and security design (requires dedicated change and migration)
1. Add `generation`/version to token row and `revoked_at` or explicit authorization state, not a bare DELETE. Secure user-intent endpoint should authenticate the Canvas identity, set revoked state transactionally, then optionally revoke at Canvas. No silent loss of audit.
2. Use a database-backed per-identity lock/lease (PostgreSQL advisory lock or lock row with deadline), plus a conditional `UPDATE ... WHERE version = expected_version AND revoked_at IS NULL`. A refresh begun before logout/disconnect cannot restore a revoked credential.
3. Preserve old token until Canvas confirms new credentials and storage succeeds; define recovery for token rotation when persistence fails (the remote refresh may invalidate the old token).
4. Validate the actual Canvas OAuth revocation API and scope before implementing user-facing disconnect. Test 400/401, 429/5xx, timeouts, revoked-in-flight and simultaneous server workers. Must not send real refresh requests in production diagnosis.
5. A durable state for unreadable ciphertext, with alert/backoff and an authenticated OAuth reauthorize mechanism, will avoid repeated warnings across restarts.

## Early shutdown limitation and recommendation
`main` now registers a coordinator before `configureMode`, but the long-running Canvas/setup calls do not all accept an AbortSignal. A shutdown during startup requests cleanup, but an unrelated docker child used by setup may still be running until it returns. A fully robust next phase requires explicit AbortSignals propagated to `CanvasBringup.waitForReady`, Runner, installers and log-follow processes, with owned-process tracking. This is a separately testable change; do not kill shared Docker containers to simulate it.

## Spanish parity
The Spanish main branch requires:
- English startup/shutdown improvements including bounded child cleanup, menu cancellation and 0/Salir, token rotation shutdown and transient-error handling, shared Docker recovery.
- Neutral English template policy ported to Spanish's own variable names; do not override existing teacher templates.
- New isolated early-shutdown tests, existing PTY and real start-stop tests, plus advanced OAuth multi-instance and resurrection *diagnostic* tests. Do **not** confuse reproduction tests that pass on unsafe behavior with regression tests asserting its repair.
- A separate migration plan for token generation and locking. Do not make breaking database schema changes directly in Spanish main.
