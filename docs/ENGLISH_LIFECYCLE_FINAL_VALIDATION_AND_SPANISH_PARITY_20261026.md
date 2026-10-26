# English lifecycle final verification and Spanish parity — 26 October 2026

## Executive verification
Branch: `english-version`. This document records actual tests, limitations and cross-language handoff. No Spanish main changes.

### Existing work validated
- Template defaults omit automatic grade and course-average variables; Canvas native points select high/medium/low. Dynamic variable controls are left for teacher opt-in.
- Bootstrap of three global English templates plus clones for a synthetic teacher passed in isolated PostgreSQL transaction; six pre-existing untouched English seeds were updated selectively with backup, with no full database wipe.
- OAuth refresh: AES-GCM decryptability, invalid-grant (400/401), transient failures (429/500/502/503/504), network timeouts, DB save failures, independent/simultaneous users, refresh deduplication, startup/shutdown timers and in-flight cancellation sequencing.
- Browser logout intentionally clears session cookies, **not** persistent OAuth grants. Tested separately for local and LTI cookies; OAuth disconnect/revoke is not yet implemented.
- Menu `[0] Exit`, valid/invalid choice validation and Ctrl+C cancellation verified with a Linux PTY. Ctrl+C at the menu exits with 130 rather than defaulting to mode 3.
- Graceful shutdown: idempotent cleanup, TLS proxy closure, token rotation shutdown, backend and Vite child management; simulated cooperative exit, ignored SIGINT -> SIGTERM and ignored SIGTERM -> SIGKILL, already exited process.

### Real end-to-end option-3 cycles (controlled noninteractive startup, SIGINT)
Commands executed with `CI=true`, `NON_INTERACTIVE=true`, `node apps/installer/src/preboot.js --mode=3`, recording logs to a file (not a terminal spinner).
- Cycle 1: startup complete, one SIGINT, clean shutdown, exit code 0, 33.1 seconds.
- Cycle 2: startup complete, one SIGINT, clean shutdown, exit code 0, 34.4 seconds.
- After each cycle, ports 3000, 5173 and 8443 were not listening.
- Docker container names before and after were identical; no shared Docker container or volume was deleted or recreated by these tests.
- Evidence: `logs/startup-shutdown-pipe-20261026.json` and `logs/startup-shutdown-pipe-20261026.log` (ignored local diagnostic data).
- The earlier full PTY simulation was not a valid measurement of boot speed or Canvas health: continuous spinner escape sequences resulted in ~87 MB of terminal capture and the tests reached their watchdog. A subsequent isolated `CanvasBringup.waitForReady()` passed, and the two complete file-logged runs passed. Avoid retaining raw animated spinner output in memory during future tests.

### Additional unit and integration checks
- `apps/installer/tests/unit/shutdown-child-escalation.test.js`: four mocked-process tests, no real signals issued to unrelated PIDs.
- `apps/server/tests/unit/logout-token-boundary.test.js`: two tests; local logout clears dev cookies, LTI logout clears local session cookies, neither claims to revoke the persistent OAuth credential.
- `tools/diagnostics/verify-start-stop-pipe.py` provides a reproducible two-cycle E2E for English with explicit safeguards; it is **not** meant to run against a production Canvas environment, and initial setup can write local environment/session metadata as the installer normally does.
- `tools/diagnostics/check-canvas-bringup-readonly.mjs`: verified the read-only Canvas readiness probe with a healthy existing stack.

## Remaining risks and proposed follow-ups
1. Ctrl+C during **early startup before setupGracefulShutdown is registered** still needs a dedicated lifecycle coordinator installed before environment checks; add adversarial tests during Docker preflight, migration, LTI setup, backend wait, and TLS creation. The successful runs validate Ctrl+C **after** startup, not all early interruptions.
2. Browser logout does not mean disconnect/revoke OAuth; implement a separate authenticated user-action workflow only if explicitly required. Must prevent a refresh in flight from writing credentials after revocation; use CAS/versioned row updates and suitable authorization checks.
3. Multi-process deployments need distributed refresh locks and reliable per-identity backoff; current in-memory deduplication only covers a single backend process. Permanent unreadable ciphertext is logged once per process, not durably quarantined.
4. Tokens in use while the backend closes need timeouts on external Canvas requests. Graceful shutdown's bounded steps prevent the orchestrator from waiting forever, but in-flight network operations may still end abruptly on a forced deadline.
5. Production/Windows shell and interactive Full PTY start-stop should be tested independently; our successful full starts were Linux WSL with noninteractive startup and real OS SIGINT, while the interactive menu was separately tested in PTY.
6. Canvas health verification and Docker log-follow spinner can create huge captures in synthetic PTYs; use bounded logging for diagnostics. Avoid changing the known-good main startup flow merely to optimize a diagnostic harness.

## Spanish parity checklist
Replicate: menu 0/Salir and Ctrl+C cancellation; validation of invalid selections; owned-process termination and bounded deadlines; awaited proxy close; token shutdown and unreadable ciphertext handling; distinction between revoked and transient Canvas refresh errors; tests for token refresh, logout and process escalation. Also reproduce neutral templates, Canvas raw-point grade classification and optional-variable omission per `docs/ENGLISH_NEUTRAL_TEMPLATES_SPANISH_PARITY.md`, and shared Docker dependency checks per `docs/ENGLISH_STARTUP_RECOVERY_AND_SPANISH_PARITY.md`. Do not simply merge all English UI strings into Spanish; port architecture and translate labels. Retest on Spanish's own data and fixtures. No Spanish changes were made in this verification.
