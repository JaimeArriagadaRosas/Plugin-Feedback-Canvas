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
