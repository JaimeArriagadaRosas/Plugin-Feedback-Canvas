# Technical Debt Register

This register separates implemented features from operational readiness. The priorities are: **P0** blocks production, **P1** must be closed before expanding a pilot, and **P2** improves maintainability/experience.

## Summary

| ID | Priority | Status | Theme |
|---|---:|---|---|
| TD-01 | P0 | open | institutional LTI certification |
| TD-02 | P0 | open | non-durable massive jobs |
| TD-03 | P0 | open | production email absent |
| TD-04 | P0 | open | historical keys rotation |
| TD-05 | P1 | open | weak/incomplete E2Es |
| TD-06 | P1 | open | RF06 writes code to filesystem |
| TD-07 | P1 | partial | final cross-platform matrix |
| TD-08 | P1 | open | production deployment/operation |
| TD-09 | P2 | open | simulated SIS variables |
| TD-10 | P2 | open | fixed grade requirement |
| TD-11 | P2 | open | limited rich formatting |
| TD-12 | P2 | open | frontend performance |
| TD-13 | P2 | open | legacy scripts and SOLID limits |
| TD-14 | P2 | open | notifications design |

## TD-01 — Institutional LTI Certification

**Issue:** modes 1/2 and LTI configuration have not been tested end-to-end against an institutional/staging Canvas with real Developer Key, deployments, scopes, and test roles.

**Risk:** OIDC/JWKS, iframe cookies, scopes, account/subaccount, identity, or endpoints failures when deploying.

**Closure:** E2E by role in staging, negative tests for issuer/audience/nonce/deployment, administrative placement review, and documented rollback.

## TD-02 — Non-durable massive jobs

**Issue:** `MassiveGenerationOrchestrator` uses `setTimeout(..., 0)` and loops within the Node process.

**Risk:** restarting/crashing loses work; there is no lease, resumption, durable state, replica coordination, or dead-letter.

**Closure:** durable queue with idempotency, states per student/assignment, retries with backoff, cancellation, observability, and demonstrated recovery after restart.

## TD-03 — Production email

**Issue:** `EmailService.local.js` writes `local-emails.log`; there is no institutional SMTP/API adapter.

**Risk:** RF42/RF44 and email preferences do not actually work in production.

**Closure:** approved provider, templates, secrets, idempotency/retries, delivery metrics, and mass testing with staging accounts.

## TD-04 — Historical keys

**Issue:** the Gitleaks baseline contains two old private keys present in public commits.

**Risk:** any system that still trusts them may be compromised.

**Closure:** inventory, confirmed revocation/rotation, and coordinated decision on history rewrite. Ignoring fingerprints does not close the risk.

## TD-05 — E2E Coverage

**Issue:** `login.spec.js` and `massive-feedback.spec.js` end with trivial asserts; the second catches title errors. Local LTI skips iframe if it does not see the link.

**Risk:** green CI without testing critical actions or real integration.

**Closure:** stable selectors, state/Canvas/DB assertions, individual and massive scenarios, and a mandatory staging suite before release.

## TD-06 — RF06 dynamic variables

**Issue:** creating a variable generates JavaScript under `services/variables` and modifies an in-memory record.

**Risk:** mutable filesystem, divergence between replicas, loss on redeploy, weak audit/rollback, and code generation surface.

**Closure:** versioned resolvers catalog + persisted/declarative configuration. See [VARIABLES.md](VARIABLES.md).

## TD-07 — Cross-platform matrix

**Progress:** full setup validated on rootless Ubuntu/WSL2; separate Linux/Windows adapters and unit tests available.

**Pending:** clean run on independent Linux host/VM, another Windows, macOS, and DNF/Pacman strategies. Log permissions, times, disk, restart, and cleanup.

## TD-08 — Production operation

**Issue:** compose files and mode 1 are references, not a certified platform.

**Pending:** TLS/ingress, immutable images, secrets, health/readiness, observability, backups, restore, migration, HA, limits, runbooks, rollback, and reproducible load testing.

## TD-09 — Simulated institutional variables

`OtherCoursePerformanceResolver`, `StudentEntryProfileResolver`, and `PreviousAcademicStatusResolver` use local/simulated data until approved SIS APIs are available.

**Closure:** contracts, privacy, timeouts, cache, fallback, and tests with institutional staging.

## TD-10 — Fixed grade requirement

Some calculations assume a Chilean scale with 60% requirement.

**Closure:** configuration per institution/course/assignment, persistence, validation, and regressions for various scales.

## TD-11 — Canvas rich text

Canvas comments do not accept the required HTML/Markdown; `RichTextProcessor` uses Unicode characters to simulate formatting.

**Risk:** accessibility, search, copy/paste, and font-dependent rendering.

**Closure:** validate a compatible Canvas official way or formally document the degradation to plain/accessible text.

## TD-12 — Frontend performance

The build warns about large chunks associated with `exceljs` and PDF viewer. There is no reproducible load/transfer baseline.

**Closure:** measure bundle and navigation, lazy-load by route/capability, performance budget, and automated regression.

## TD-13 — Scripts and SOLID

Loose repair/diagnostic scripts and legacy modules with uneven nomenclature/responsibility persist.

**Closure:** inventory consumers, move reusable logic to `apps/server/src`, leave thin entrypoints, and retire scripts without a supported flow. Maintain 300 lines/file and 100/function unless documented exception.

## TD-14 — Notifications design

Toasts, banners, persistent alerts, and notifications do not yet share a complete visual/semantic system.

**Closure:** states, accessibility, severities, and common components; visual and screen reader tests.

## Maintenance rules

- Any new debt includes evidence, risk, priority, and verifiable closing criteria.
- "There is code" does not equal "it works in production".
- When closing a debt, link tests/commit/artifact and update [README](README.md), [TESTING](TESTING.md), or [DEPLOYMENT](DEPLOYMENT.md) as appropriate.
- Secrets or private reports are not kept in this document.
