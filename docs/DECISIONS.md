# Architecture Decision Records

ADRs explain why a decision exists. New changes must add or replace an ADR; the past is not rewritten to appear as though a decision was always different.

## ADR-001: local TLS proxy for Canvas

- **Status:** accepted.
- **Context:** Local Canvas serves HTTP on `:8080`, while LTI and the browser require coherent HTTPS origins.
- **Decision:** use a local TLS proxy on `:8443` directed to Canvas HTTP.
- **Consequences:** there are local certificates and an additional process; production must use public TLS on the institutional proxy/ingress, not this certificate.

## ADR-002: pinned dependencies and Canvas

- **Status:** accepted, reviewed in August 2026.
- **Context:** npm 9 did not reproduce the lockfile; a moving Canvas branch made the setup non-deterministic.
- **Decision:** declare Node `^20.19.0 || >=22.12.0`, npm 11.8.0, and pin local Canvas to `release/2026-05-20.143`.
- **Consequences:** installations with `npx --yes npm@11.8.0 ci`; updates require a branch, lockfile review, and setup regression test.

## ADR-003: monorepo with npm workspaces

- **Status:** accepted.
- **Context:** client and server evolve together and share a single delivery.
- **Decision:** use a repository with `apps/*` workspaces and a `packages/*` reservation.
- **Consequences:** a single lockfile and pipeline. In the current tree, only `apps/client` and `apps/server` are effective workspaces; non-existent shared packages are not documented.

## ADR-004: AI providers via strategy/factory

- **Status:** accepted; replaces the decision "Gemini as the sole engine".
- **Context:** different environments require Gemini, OpenAI, Claude, or a compatible/custom endpoint.
- **Decision:** select an adapter with `IAProviderFactory`; the feedback domain does not know the HTTP details of each provider.
- **Consequences:** each adapter must normalize errors, timeouts, and models; credentials are encrypted/managed outside the frontend. Gemini can be the local default without becoming a single dependency.

## ADR-005: Local Canvas outside the repository

- **Status:** accepted.
- **Context:** Canvas LMS is a large upstream project used as a simulator, not plugin logic.
- **Decision:** keep `canvas-lms-master` as a sibling folder and pin the release.
- **Consequences:** generated Canvas assets/configuration are not versioned; the setup protects unknown destinations and preserves an existing `.env`.

## ADR-006: explicit adaptation per operating system

- **Status:** accepted.
- **Context:** a single conditional branch mixed Docker Desktop/UAC, APT/systemd, Gatekeeper, and WSL.
- **Decision:** shared probes and policies; native actions in `Win…`, `Mac…`, `Linux…` adapters and WSL policies.
- **Consequences:** one platform does not issue instructions for another; adding a system requires a specific adapter and tests without bloating the coordinator.

## ADR-007: Rootless Docker preferred in Linux

- **Status:** accepted.
- **Context:** the `docker` group grants control equivalent to root and caused permissions/security issues.
- **Decision:** after installing Docker Engine, offer rootless as the recommended option; the group requires a separate confirmation.
- **Consequences:** UID/GID mappings and some cgroups/network limitations appear; Canvas writes are executed with the necessary internal user without turning the host into root.

## ADR-008: Canvas configuration via resumable overrides

- **Status:** accepted.
- **Context:** editing/destroying upstream configuration made the setup fragile and non-idempotent.
- **Decision:** preserve existing files, start from official Docker templates, and apply explicit local overrides/versions.
- **Consequences:** the setup must distinguish between a missing, recognized, and unknown folder; any destructive reset falls outside of automatic recovery.

## ADR-009: reproducible npm installation in preboot

- **Status:** accepted.
- **Context:** `npm install`, `shell: true`, and unlimited retries could modify the lockfile or saturate processes.
- **Decision:** invoke `npx --yes npm@11.8.0 ci` with structured arguments and a maximum of one repair attempt.
- **Consequences:** startup fails visibly if the reproducible installation cannot be completed; it does not hide incompatibilities through another resolution.

## ADR-010: `.local` suffix as versioned adapter

- **Status:** accepted with progressive migration.
- **Context:** `.local` is used for behavior specific to the development environment, not for secrets ignored by Git.
- **Decision:** version those modules and activate them only from composition roots/local guards. Share domain and use cases.
- **Consequences:** a global `.gitignore` rule is not applied to `*.local.*`; each bypass must demonstrate that production cannot reach it.

## ADR-011: Removal of the `scripts/` directory

- **Status:** accepted and completed.
- **Context:** there were legacy scripts for deploy, repair, and diagnostics with unequal responsibility in a generic root directory.
- **Decision:** the `scripts/` directory has been removed. Entry logic and operational commands now live in their corresponding modules, such as `apps/installer/src/commands/` and `apps/server/bin/`.
- **Consequences:** higher cohesion; dependencies are clear for each application.
