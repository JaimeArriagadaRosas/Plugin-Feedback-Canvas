# English template bootstrap validation - 2026-10-27
Branch: english-version. Worktree isolated from Spanish main.

## Original failures reproduced against PostgreSQL 15
Initial English logic failed three of eight scenarios:
- Concurrent first requests: duplicate unique key.
- Partially initialized teacher: duplicate unique key.
- Professor_Metadata marked seeded without templates: returned none.

## Repair
- Locale-specific checks for Standard Class, Detailed Feedback and Peer Review; deleted records count as intentionally handled.
- Transaction with PostgreSQL advisory lock for locale seeds and teacher copies.
- Typed teacher placeholder $1::varchar(50), existence checks and ON CONFLICT DO NOTHING.
- Normalize only English global seeds, not unrelated records.
- Refresh teacher templates after initialization, including when another request inserted in parallel.
- Maintain template edits, custom records and soft-deletes.

## Verification
RUN_DOCKER_TESTS=true vitest run apps/server/tests/unit/english-template-bootstrap-extended-postgres.test.js: 8/8 passed.
npm test: 321 passed, 9 skipped; isolated worktree used an ephemeral testing-only ENCRYPTION_KEY and symlinked preinstalled node_modules; no application credentials were read or changed.
npm run lint: passed. git diff --check: passed.

## Remaining validations
Browser-based LTI login and assign/edit/preview operations; failure-injection transaction rollback and fully clean installation of Canvas need an isolated environment. No production or Spanish volumes have been deleted or reset.
