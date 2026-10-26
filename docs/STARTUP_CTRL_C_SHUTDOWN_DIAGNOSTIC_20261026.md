# Startup menu and graceful shutdown investigation — 2026-10-26

Scope: English branch, diagnostic-only. No production startup, shutdown, process management or Canvas database behavior was changed.

## Evidence
- Unit diagnosis: `startup-menu-interrupt-diagnostics.test.js` and `startup-shutdown-diagnostics.test.js`: 9 tests passed. These encode **existing defects**, not acceptance criteria.
- Real isolated Linux PTY: `python3 tools/diagnostics/simulate-startup-pty.py` executes only `showMainMenu()`, with no app bootstrap and no Docker mutation.
- PTY results: Ctrl+C => SIM_SELECTED=3 and exit 0; blank Enter => 3; explicit 0 => 0 (unhandled by orchestrator); invalid 999 => 999 (unvalidated).
- Child mock: a child ignoring SIGINT leaves `stopBackend` unresolved indefinitely. A second shutdown call triggers `process.exit(1)` while earlier cleanup is still pending. These are reproduced without killing real services.

## Root cause
1. `cli.ask()` catches **all** prompt failures, including `ExitPromptError` from Ctrl+C, and converts them into the default argument. The startup menu defaults to 3.
2. The menu has no explicit 0 exit option or mode validation. Any string reaches `main()` and may advance through environment preparation.
3. `stopChild()` has no timeout, SIGTERM escalation or bounded wait. It waits for the direct child exit; `spawnVite()` starts `npm run dev` with ignored stdio, which may leave descendant Vite processes listening on 5173 after npm exits.
4. `setupGracefulShutdown()` sets raw input mode and listens to both signals and raw Ctrl+C, calls `process.exit(0)` only after serial awaits, and forces exit 1 on a second signal; a stuck await prevents ever reaching normal exit.
5. `stopTlsProxy()` is fire-and-forget; its server.close() completion is not awaited. Active keep-alive/long-running connections can delay closure. During startup, `setupGracefulShutdown()` is installed only after `startServices()` returns, so interrupts at earlier phases lack the same cleanup guarantees.
6. Backend shutdown calls server.close() without awaiting its callback, although the token-rotation job waits for any ongoing refresh. Thus server termination ordering is not fully verified.

## Proposal (not implemented)
A. Make menu handling explicit: `0 — Exit` and choices 0..5 only. Distinguish blank Enter (default 3) from cancellation (ExitPromptError / SIGINT / EOF): cancel => stop with exit 130, never boot Canvas. Return an explicit outcome or throw a typed cancellation exception; do not convert prompt errors to defaults.
B. A single shutdown coordinator with states `starting | running | stopping | stopped`, installed before port/setup operations. Ctrl+C and SIGTERM request the same idempotent Promise, preventing a second cleanup. Early failure uses the same owner-aware cleanup and correct non-zero exit status.
C. Track exact child process identity/group at creation; terminate only children started by this invocation. First send SIGINT (or configured graceful signal), wait for exit with a bounded deadline, then escalate SIGTERM and finally SIGKILL only for the *verified owned group* and only after the deadline. Do not terminate Docker containers, other worktrees or ports merely because they are open. Re-check identity before escalation.
D. Start Vite via direct process where practical, or a dedicated process group rather than an npm wrapper; await its exit and verify no owned descendant still listens. Keep inherited terminal TTY state and input listeners cleaned up even on errors. Return exit 0 on completed user-requested shutdown, 1 on startup failure, and a clearly documented code for forced escalation.
E. Make TLS proxy closure asynchronous and awaited with a bounded timeout; gracefully close active HTTP connections, then await backend HTTP close, token job and DB pool. Cleanup should not hang due to socket keep-alive.
F. A watchdog timer should guarantee control returns to the shell **after** cleanup attempts reach their deadline, with a concise report of any process that could not be closed. Do not send a synthetic second Ctrl+C.

## Acceptance tests for implementation
- Menu: 0, 1–5, blank Enter, whitespace, unexpected input, Ctrl+C, Ctrl+D, SIGTERM, noninteractive explicit mode and missing env; cancelled menu never starts services or writes .env.
- Early boot: Ctrl+C during Docker verification, credential prompt, port-conflict confirmation, backend wait, Vite launch, and TLS launch; partial ownership cleanup only.
- Running: SIGINT once, twice, rapidly repeated, SIGTERM, and calls to shutdown concurrently; exactly one cleanup.
- Children: cooperative exit, child exits before stop, SIGINT ignored, SIGTERM ignored, PID reuse, child spawn error, wrapper npm leaving Vite grandchild and multiple independent app instances.
- Network: active HTTP request, keep-alive socket, TLS proxy closing, PostgreSQL rotation in flight and failed DB close.
- Verify bounded termination and no residual **owned** listeners at 3000/5173/8443; shared Canvas/PostgreSQL Docker containers and volumes remain intact.
- Cross-platform: Linux WSL PTY and Windows PowerShell terminal; preserve Ctrl+C semantics and avoid double prompts from npm wrappers.
- Run full installer/server regression and lint. Keep identical test cases in the Spanish parity checklist, translating only UI labels.

## Spanish parity later
Spanish main is not modified. Port the same cancellation semantics, coordinator, ownership checks, process termination, and exact tests after proving the English implementation. Spanish UI must say `[0] Salir` and avoid auto-running option 3 on cancellation.
