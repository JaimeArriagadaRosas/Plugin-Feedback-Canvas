# English startup recovery and Spanish parity handoff

## Scope and safety
Date: 2026-10-26. Branch: english-version.
The existing clean startup path is unchanged. When the *dependency preflight* indicates unavailable Docker services, the recovery decision inspects fixed-name dependencies before any removal/recreation action. Nothing in this change resets a volume or changes the English/Spanish language selection.

## Root cause
Two distinct monorepo checkouts use different Docker Compose project names, while docker-compose.db.yml sets fixed container names (`feedback_plugin_db_local`, `feedback_plugin_gotenberg_local`). Compose may report missing dependencies in the current project even though healthy containers from another project exist. Calling `docker compose rm/up` then collides with those names. Separately, existing app ports may be occupied by an installer instance from another checkout. The existing port manager requires exact `YES` for termination; lowercase `yes` correctly cancels.

## Recovery behavior
- Normal preflight healthy: original installer execution proceeds without entering the recovery module.
- Both shared containers absent: use the existing normal setup path.
- Both containers present and healthy with expected Compose labels: reuse, without re-creating or removing containers. This does not establish full database identity compatibility and must be strengthened before relying on reused databases outside this isolated development environment.
- Unexpected labels, partial availability, or unhealthy shared containers: stop before mutating shared resources and explain the conflict.
- Never automatically delete volumes, rename another project's containers, kill its processes, or alter credentials.
- PortManager is left unchanged; process termination still requires exact explicit `YES`. A future enhancement can add non-destructive port-owner diagnostics and reuse, but must have its own tests.

## Testing and parity requirements
Targeted tests: `shared-dependency-recovery.test.js`, `environment-setup.test.js`, `port-manager.test.js`. Tests cover clean path, healthy shared services, partial service, and unexpected labels without invoking live destructive Docker commands. Run installer/server suites and lint before release.

For Spanish parity, port `SharedDependencyRecovery.js`, integration in `EnvironmentSetup.js`, and tests after comparing against Spanish main (do not cherry-pick unrelated English features). Inspect `docker-compose.db.yml`, credential compatibility, database/volume identity and existing port handling independently in Spanish. Preserve the Spanish UI/messages. Run a clean boot and a simulated conflict in both language branches before publishing. Do not merge this handoff directly into Spanish `main` without validation.

## Known limitation
Current compatibility proof is container identity and health, *not* full DB schema, port mappings, authentication, or volume identity. Therefore shared dependency reuse is conservative regarding conflicts but not a security boundary. Production readiness requires an explicit database/volume compatibility probe, and error reporting should remain diagnostic when compatibility cannot be established.

## Expanded startup scenarios and real boot — 2026-10-26

Additional simulated cases were added to `apps/installer/tests/unit/shared-dependency-recovery.test.js`: clean/absent, compatible shared containers, partial services, stopped service, foreign service label, wrong image, wrong host port, missing PostgreSQL volume, and inspection-only execution. `shared-postflight-startup.test.js` covers clean startup unchanged, shared-service reuse, unrelated failure not suppressed, and unhealthy services not bypassed. No test deletes a volume or terminates a process.

Real run A: `node apps/installer/src/preboot.js --mode=3` in English checkout detected healthy containers owned by `plugin-feedback-canvas-switch-test` but post-installation verification incorrectly required the current Compose project; exited 1 without deleting containers. Fixed the second check to re-inspect shared containers only when the *sole* reported failures are the two plugin dependencies.

Real run B: option 3 advanced through postflight, Canvas initialization, TLS proxy, backend and Vite. HTTP checks returned 200 for `https://localhost:3000/health`, `https://localhost:5173`, and `https://localhost:8443/login/canvas`. The backend's own Docker fallback still tried `docker compose up` during an initial DB probe and logged a name collision although it subsequently connected. `apps/server/src/data/docker.local.js` now consults the same recovery guard before attempting Compose, **only in its pre-existing failure path**, so clean startup is untouched. This secondary path requires another real startup regression to confirm the warning is absent.

One token-refresh decryption error was observed at shutdown; it is independent of the container name conflict and was not modified in this work. The specific option-3 process started for this test was sent SIGINT and logged graceful shutdown; Docker volumes were not cleared.

Spanish handoff must also include `apps/server/src/data/docker.local.js`, postflight handling in `EnvironmentSetup.js`, `shared-postflight-startup.test.js`, and the expanded scenarios in `shared-dependency-recovery.test.js`. Container identity checks include expected image, mapped ports, PostgreSQL environment, and presence of a data volume. They do *not* prove schema-version or full stored-data compatibility. Before Spanish release, validate with a clean dedicated fixture and do not assume cross-branch DB compatibility merely because the container is healthy.

## Verified final Fast Boot

Third live launch succeeded after the backend recovery guard was added: option 3 reached Startup completed without Docker container-name conflicts, and Canvas, HTTPS backend/proxy and Vite were started. The installer and server regression suite passed: 246 tests, one skipped, zero failed, plus full ESLint. The test launcher was stopped via SIGINT and its remaining Vite child via SIGTERM to leave the app ports free. Existing Docker volumes were preserved. The future Spanish parity checklist must include the backend fallback guard in apps/server/src/data/docker.local.js and the second preflight handling in EnvironmentSetup.js.
