# Student Feedback Rating Regression - 2026-10-27

## Scope
Teacher approves feedback; student opens it through Canvas LTI and rates independently with 1-5 stars and a usefulness Yes/No response.

## Reproduced failures before repair
- PostgreSQL: UPDATE referenced absent historial_feedback_generado.actualizado_en, SQL errors after POST /api/student/rate.
- Input validation: rejected usefulness-only requests and incorrectly allowed non-integer stars.
- React Query: optimistic onMutate displayed the saved confirmation before HTTP success and did not clear it on failure.

## Changes
- Repository: remove non-existent column from update; preserve unchanged rating dimension; return null on missing row.
- Mutation service: validate rating and usefulness independently, verify LTI student identity and row ownership, reject missing or unpublished feedback, and return stored values.
- API validation: accept either stars or usefulness, reject unknown fields or empty updates, enforce integer star range 1-5.
- Controller: return persisted values.
- Client: submit only supplied values, await backend success before showing confirmation, preserve last persisted state, show error on failure, prevent concurrent clicks while a request is pending, and update React Query cache after success.

## Tests and results
- 14 validation scenarios and 9 real PostgreSQL 15 scenarios: 23/23 pass (first run: 6 failures reproduced). Includes idempotency, cross-student isolation, unchanged timestamps, simulated database failure and retry.
- React hook / UI state: 6/6 pass (success delayed until server response; HTTP 500; usefulness-only false; rapid repeat requests; reopening saved feedback; failed request followed by a successful retry).
- Server + installer npm test: 335 passed (PostgreSQL tests skipped in the default run and run separately). PostgreSQL-enabled complete server CI equivalent: 175/175 passed.
- ESLint: pass.
- Frontend build: pass (existing bundle-size warning).
- Full client suite including Storybook Chromium: 20/20 passed; one MDX file contains no tests.
- Regular server + installer suite after adding four new PostgreSQL checks: 335 passed, 20 skipped (all PostgreSQL integration cases executed separately with RUN_DOCKER_TESTS=true).
- GitHub Actions postgres-integration now runs all server tests with disposable PostgreSQL enabled, instead of only backend_smoke. A test-only encryption key is provided; no real secrets are modified.
- No destructive Docker/database operations.

## Follow-up
A browser-based LTI acceptance test using a logged-in real student is still recommended for visible stars/usefulness after refresh, network interruption and log-in recovery. Restart only backend and Vite so the UI loads updated code. No migration needed because no schema changes were made.
