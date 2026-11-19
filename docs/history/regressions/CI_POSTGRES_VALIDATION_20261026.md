# CI validation and PostgreSQL isolation — 2026-10-26

Both the English and Spanish branches retain 301 passing unit tests, zero failures and one default-skipped integration test. ESLint passes in both local worktrees. The skipped test is an opt-in PostgreSQL Testcontainers integration case, not feedback generation.

## Fixes
- The English GitHub Actions unit-test job now has an explicitly quoted, non-production, 64-digit hexadecimal fixture key. The Spanish workflow already used the equivalent fixture.
- The opt-in `backend_smoke.test.js` in **both locales** now opens a disposable PostgreSQL 15 container, makes a real SQL `SELECT current_database(), 1` using `pg.Pool` and checks the returned database identity. Both isolated local executions passed. It does not connect to the regular application DB; it is not a feedback-generation end-to-end test nor a full HTTP backend smoke test.
- An independent `postgres-integration` job in both workflows runs the opt-in test with `RUN_DOCKER_TESTS=true` on a GitHub Actions runner with Docker.

## Evidence and scope
- English: local lint 0 errors, unit tests 301 passed / 1 skipped, opt-in PostgreSQL 1 passed.
- Spanish: local lint 0 errors, unit tests 301 passed / 1 skipped, opt-in PostgreSQL 1 passed.
- A prior CI error `SASL: client password must be a string` indicates attempted database initialization by other test imports; the new integration test does not alone prove that every unit-test import is fully mocked. Investigate that error separately if it reappears in fresh GitHub Actions runs.
- GitHub Actions success is not asserted until its remote jobs finish successfully.
- Still pending: full real HTTP + feedback end-to-end parity verification, broader module contract diff, refresh token distributed coordination.

## Branch retirement
- The Spanish feature branch should be removed only once `origin/main` points to its exact tip. Keep all untracked WSL scripts and dependency symlinks; switching its worktree to `main` preserves those files. Keep English on `english-version`.
