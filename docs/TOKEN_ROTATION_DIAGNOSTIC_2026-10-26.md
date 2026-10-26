# Token rotation investigation — 2026-10-26 (English branch)

## Scope
Read-only investigation of live local PostgreSQL, uploaded terminal log, code trace, and isolated unit tests. No stored OAuth token, encryption key, Canvas account or database row was modified. No OAuth refresh request was made against Canvas during the investigation.

## Proven root cause
The proactive job starts automatically on backend startup, schedules an initial pass after five seconds, and repeats every five minutes. Each pass selects records expiring within fifteen minutes, and `CanvasTokenRepository.getExpiringTokens` calls `EncryptionService.safeDecrypt` on refresh tokens before filtering null results. A failed AES-GCM authentication is logged unconditionally on each pass. The same expired record is selected repeatedly because scanning does not quarantine or back off on decrypt failures. This is not evidence of the plugin crashing.

The read-only audit of `canvas_user_tokens` found two records:
- identity `874b762c-eb60-467e-a3c9-6966c63b3ced`: expired; access token and refresh token are both AES-GCM-format ciphertext but **neither decrypts with the current ENCRYPTION_KEY**.
- identity `fea2bc9f-1401-4a0f-9236-8cc206652761`: unexpired; both encrypted tokens decrypt successfully with the current key.
No plaintext secrets were printed. This evidence is consistent with an older encryption key or corrupted/replaced ciphertext for the first record, but cannot distinguish those causes without key history. It is not evidence that the key itself is invalid globally; the other record decrypts successfully.

## Flow reviewed
1. `appFactory.startServer` starts `TokenRotationJob`.
2. `TokenRotationJob.start`: schedules `setTimeout(...,5000)`, then `setInterval(...,300000)`.
3. `run`: selects `expires_at <= now+15min`; `CanvasTokenRepository.getExpiringTokens` decrypts refresh token, logs on failure, drops null.
4. Valid candidates use `CanvasTokenManager.refreshToken`, which deduplicates simultaneous refresh for one identity with a Promise map. It retries transient errors up to three attempts and invalidates/requires new OAuth after HTTP 400/401.
5. `CanvasTokenRepository.saveToken` encrypts the returned access/refresh tokens and persists them.

## Additional defects/risk
- `stop()` clears only the recurring interval, not the 5-second initial timeout. Test reproduces a post-stop database scan.
- A repeating un-decryptable expired row produces one error per scan, forever; this is noisy and potentially masks other incidents.
- Automatic deletion in `CanvasTokenRepository.getToken` applies to failed **access** decryption in local mode. The rotation scan does not delete rows. Avoid treating key mismatch as reason for bulk deletion.
- `CanvasTokenManager._executeRefreshToken` treats HTTP 400/401 as invalid grant and deletes the user's stored token, requiring OAuth again. Its retries and failure handling need a separate Canvas mock integration test for network timeout/5xx and revoked token before behavioral changes.

## Unit tests (no Canvas writes)
`apps/server/tests/unit/token-rotation-diagnostics.test.js` covers empty/unreadable refresh candidates, 15-minute threshold, success and null candidate, per-user failure isolation, concurrent refresh deduplication, AES-GCM corrupted ciphertext and the known initial-timeout-after-stop defect. Seven tests passed.

## Proposed repair (not applied)
- Track and cancel the initial timeout on stop; prevent overlapping job runs.
- Move decryption-status classification to a repository-level result that distinguishes missing, corrupted/unreadable and valid values. Use a once-per-identity warning or exponential log throttling; never log tokens or key material.
- For unrecoverable unreadable credentials, mark the record as requiring reauthorization, preserving it for audit and avoiding repeated decryption until credential/key status changes. Do **not** rewrite tokens or change ENCRYPTION_KEY.
- New OAuth for the affected identity should replace its unusable tokens through the ordinary authorized callback; do not reset the other working user's credentials.
- Add regression tests for revoked grants, transient 429/5xx, stop-before-first-run, overlapping runs, readable vs unreadable ciphertext, silent periodic rescans and eventual recovery after authorized OAuth.

## Spanish parity
The branch should preserve this diagnostic and its tests when parity work starts, but the proposed behavioral changes have **not** been made on either branch.
